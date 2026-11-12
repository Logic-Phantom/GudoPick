import {
  ANSWERS_VERSION,
  BUILTIN_PRESET_SEEDS,
  migrateAnswers,
  type Preset,
  type PresetSeed,
} from '@/domain/preferences/preset';
import type { PreferenceAnswers } from '@/domain/preferences/profile-factory';

import type { SqlDriver } from './sql-driver';

interface PresetRow {
  id: string;
  name: string;
  answers_json: string;
  answers_version: number;
  cover_key: string;
  is_default: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PresetInput {
  name: string;
  answers: PreferenceAnswers;
  coverKey: string;
}

export const PRESET_NAME_MAX_LENGTH = 20;

export function normalizePresetName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return trimmed.slice(0, PRESET_NAME_MAX_LENGTH);
}

function rowToPreset(row: PresetRow): Preset {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.answers_json);
  } catch {
    parsed = null;
  }
  return {
    id: row.id,
    name: row.name,
    answers: migrateAnswers(parsed, row.answers_version),
    coverKey: row.cover_key,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PresetsRepository {
  constructor(
    private readonly db: SqlDriver,
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = defaultId,
  ) {}

  async list(): Promise<Preset[]> {
    const rows = await this.db.getAllAsync<PresetRow>(
      'SELECT * FROM presets ORDER BY sort_order ASC, created_at ASC, id ASC',
    );
    return rows.map(rowToPreset);
  }

  async get(id: string): Promise<Preset | null> {
    const row = await this.db.getFirstAsync<PresetRow>('SELECT * FROM presets WHERE id = ?', [id]);
    return row ? rowToPreset(row) : null;
  }

  async getDefault(): Promise<Preset | null> {
    const row = await this.db.getFirstAsync<PresetRow>(
      'SELECT * FROM presets ORDER BY is_default DESC, sort_order ASC, created_at ASC LIMIT 1',
    );
    return row ? rowToPreset(row) : null;
  }

  async create(input: PresetInput, options: { makeDefault?: boolean } = {}): Promise<Preset> {
    const name = normalizePresetName(input.name);
    if (name.length === 0) throw new Error('프리셋 이름을 입력해 주세요.');

    const id = this.createId();
    const timestamp = this.now();
    const order = await this.db.getFirstAsync<{ next: number | null }>(
      'SELECT MAX(sort_order) + 1 AS next FROM presets',
    );
    const count = await this.db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM presets');
    const makeDefault = options.makeDefault === true || (count?.total ?? 0) === 0;

    await this.db.withTransactionAsync(async () => {
      if (makeDefault) await this.db.runAsync('UPDATE presets SET is_default = 0');
      await this.db.runAsync(
        `INSERT INTO presets
          (id, name, answers_json, answers_version, cover_key, is_default, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          JSON.stringify(input.answers),
          ANSWERS_VERSION,
          input.coverKey,
          makeDefault ? 1 : 0,
          order?.next ?? 0,
          timestamp,
          timestamp,
        ],
      );
    });
    const created = await this.get(id);
    if (!created) throw new Error('프리셋을 저장하지 못했어요.');
    return created;
  }

  async update(id: string, input: PresetInput): Promise<Preset> {
    const name = normalizePresetName(input.name);
    if (name.length === 0) throw new Error('프리셋 이름을 입력해 주세요.');
    await this.db.runAsync(
      `UPDATE presets
          SET name = ?, answers_json = ?, answers_version = ?, cover_key = ?, updated_at = ?
        WHERE id = ?`,
      [name, JSON.stringify(input.answers), ANSWERS_VERSION, input.coverKey, this.now(), id],
    );
    const updated = await this.get(id);
    if (!updated) throw new Error('프리셋을 찾을 수 없어요.');
    return updated;
  }

  async duplicate(id: string): Promise<Preset> {
    const source = await this.get(id);
    if (!source) throw new Error('프리셋을 찾을 수 없어요.');
    return this.create({
      name: normalizePresetName(`${source.name} 복사본`),
      answers: source.answers,
      coverKey: source.coverKey,
    });
  }

  async setDefault(id: string): Promise<void> {
    const target = await this.get(id);
    if (!target) throw new Error('프리셋을 찾을 수 없어요.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE presets SET is_default = 0');
      await this.db.runAsync('UPDATE presets SET is_default = 1 WHERE id = ?', [id]);
    });
  }

  /** 삭제한다. 기본 프리셋을 지웠다면 남은 것 중 첫 번째를 기본으로 지정한다. */
  async remove(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM presets WHERE id = ?', [id]);
      const stillDefault = await this.db.getFirstAsync<{ id: string }>(
        'SELECT id FROM presets WHERE is_default = 1 LIMIT 1',
      );
      if (!stillDefault) {
        const first = await this.db.getFirstAsync<{ id: string }>(
          'SELECT id FROM presets ORDER BY sort_order ASC, created_at ASC LIMIT 1',
        );
        if (first) await this.db.runAsync('UPDATE presets SET is_default = 1 WHERE id = ?', [first.id]);
      }
    });
  }

  async removeAll(): Promise<void> {
    await this.db.runAsync('DELETE FROM presets');
  }

  /** 예시 프리셋을 넣는다. 이미 프리셋이 있으면 아무것도 하지 않는다. */
  async seedBuiltins(seeds: readonly PresetSeed[] = BUILTIN_PRESET_SEEDS): Promise<void> {
    const count = await this.db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM presets');
    if ((count?.total ?? 0) > 0) return;
    for (const seed of seeds) {
      await this.create(seed);
    }
  }
}

let idCounter = 0;
function defaultId(): string {
  idCounter += 1;
  return `p_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
