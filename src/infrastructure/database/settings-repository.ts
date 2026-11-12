import type { SqlDriver } from './sql-driver';

export interface AppSettings {
  onboardingCompleted: boolean;
  /** 준비 완료 시 진동 피드백 */
  hapticsEnabled: boolean;
  /** 카메라 화면 안내 문구 표시 */
  guidanceMessagesEnabled: boolean;
  /** 촬영 도움말(첫 진입 안내) 표시 */
  shootingTipsEnabled: boolean;
  /** 카메라 3분할/중앙 그리드 표시 (카메라 화면 토글과 연동) */
  gridEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  hapticsEnabled: true,
  guidanceMessagesEnabled: true,
  shootingTipsEnabled: true,
  gridEnabled: true,
};

const SETTINGS_KEY = 'app_settings';

export function parseSettings(raw: string | null | undefined): AppSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>>;
    const result: AppSettings = { ...DEFAULT_SETTINGS };
    (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]).forEach((key) => {
      if (typeof parsed[key] === 'boolean') result[key] = parsed[key] as boolean;
    });
    return result;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class SettingsRepository {
  constructor(private readonly db: SqlDriver) {}

  async load(): Promise<AppSettings> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
      SETTINGS_KEY,
    ]);
    return parseSettings(row?.value);
  }

  async save(settings: AppSettings): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [SETTINGS_KEY, JSON.stringify(settings)],
    );
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.load()), ...patch };
    await this.save(next);
    return next;
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM meta');
  }
}
