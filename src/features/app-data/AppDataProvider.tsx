import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  BUILTIN_PRESET_SEEDS,
  coverKeyForMode,
  SKIP_DEFAULT_PRESET_NAME,
  type Preset,
} from '@/domain/preferences/preset';
import type { PreferenceAnswers } from '@/domain/preferences/profile-factory';
import { openAppDatabase } from '@/infrastructure/database/client';
import { PresetsRepository, type PresetInput } from '@/infrastructure/database/presets-repository';
import {
  DEFAULT_SETTINGS,
  SettingsRepository,
  type AppSettings,
} from '@/infrastructure/database/settings-repository';
import { cleanupStaleCaptures } from '@/infrastructure/files/capture-files';

type LoadState = 'loading' | 'ready' | 'error';

interface AppDataValue {
  state: LoadState;
  errorMessage: string | null;
  settings: AppSettings;
  presets: Preset[];
  /** 기본(현재 선택된) 프리셋 */
  activePreset: Preset | null;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  completeOnboarding(answers: PreferenceAnswers | null): Promise<void>;
  createPreset(input: PresetInput, makeDefault?: boolean): Promise<Preset>;
  updatePreset(id: string, input: PresetInput): Promise<void>;
  duplicatePreset(id: string): Promise<void>;
  deletePreset(id: string): Promise<void>;
  selectPreset(id: string): Promise<void>;
  /** 앱 안의 프리셋·온보딩·설정을 모두 지운다. 사진 앱에 저장한 사진은 건드리지 않는다. */
  resetAllData(): Promise<void>;
  retry(): void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

interface Repositories {
  presets: PresetsRepository;
  settings: SettingsRepository;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repositories | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await openAppDatabase();
        const next: Repositories = {
          presets: new PresetsRepository(db),
          settings: new SettingsRepository(db),
        };
        const [loadedSettings, loadedPresets] = await Promise.all([next.settings.load(), next.presets.list()]);
        cleanupStaleCaptures();
        if (cancelled) return;
        setRepos(next);
        setSettings(loadedSettings);
        setPresets(loadedPresets);
        setErrorMessage(null);
        setState('ready');
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const requireRepos = useCallback((): Repositories => {
    if (!repos) throw new Error('저장소가 아직 준비되지 않았어요.');
    return repos;
  }, [repos]);

  const reloadPresets = useCallback(async () => {
    setPresets(await requireRepos().presets.list());
  }, [requireRepos]);

  const value = useMemo<AppDataValue>(() => {
    const activePreset = presets.find((preset) => preset.isDefault) ?? presets[0] ?? null;
    return {
      state,
      errorMessage,
      settings,
      presets,
      activePreset,
      async updateSettings(patch) {
        setSettings(await requireRepos().settings.update(patch));
      },
      async completeOnboarding(answers) {
        const { presets: presetRepo, settings: settingsRepo } = requireRepos();
        await presetRepo.seedBuiltins(BUILTIN_PRESET_SEEDS);
        if (answers) {
          await presetRepo.create(
            { name: '내 취향', answers, coverKey: coverKeyForMode(answers.mode) },
            { makeDefault: true },
          );
        } else {
          const all = await presetRepo.list();
          const fallback = all.find((preset) => preset.name === SKIP_DEFAULT_PRESET_NAME) ?? all[0];
          if (fallback) await presetRepo.setDefault(fallback.id);
        }
        setSettings(await settingsRepo.update({ onboardingCompleted: true }));
        await reloadPresets();
      },
      async createPreset(input, makeDefault = false) {
        const created = await requireRepos().presets.create(input, { makeDefault });
        await reloadPresets();
        return created;
      },
      async updatePreset(id, input) {
        await requireRepos().presets.update(id, input);
        await reloadPresets();
      },
      async duplicatePreset(id) {
        await requireRepos().presets.duplicate(id);
        await reloadPresets();
      },
      async deletePreset(id) {
        await requireRepos().presets.remove(id);
        await reloadPresets();
      },
      async selectPreset(id) {
        await requireRepos().presets.setDefault(id);
        await reloadPresets();
      },
      async resetAllData() {
        const { presets: presetRepo, settings: settingsRepo } = requireRepos();
        await presetRepo.removeAll();
        await settingsRepo.clear();
        cleanupStaleCaptures();
        setPresets([]);
        setSettings({ ...DEFAULT_SETTINGS });
      },
      retry() {
        setState('loading');
        setAttempt((current) => current + 1);
      },
    };
  }, [state, errorMessage, settings, presets, requireRepos, reloadPresets]);

  return <AppDataContext value={value}>{children}</AppDataContext>;
}

export function useAppData(): AppDataValue {
  const value = use(AppDataContext);
  if (!value) throw new Error('useAppData는 AppDataProvider 안에서만 사용할 수 있어요.');
  return value;
}
