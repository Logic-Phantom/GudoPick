/**
 * @jest-environment node
 *
 * 로컬 DB 통합 테스트. 앱은 expo-sqlite를 쓰지만 저장소 계층은 SqlDriver 인터페이스에만
 * 의존하므로, 테스트에서는 Node 내장 SQLite(node:sqlite)로 실제 SQL을 실행한다.
 */
import { ANSWERS_VERSION, BUILTIN_PRESET_SEEDS } from '@/domain/preferences/preset';
import { DEFAULT_ANSWERS } from '@/domain/preferences/profile-factory';
import { getSchemaVersion, MIGRATIONS, runMigrations, type Migration } from '@/infrastructure/database/migrations';
import { PresetsRepository, PRESET_NAME_MAX_LENGTH } from '@/infrastructure/database/presets-repository';
import { DEFAULT_SETTINGS, parseSettings, SettingsRepository } from '@/infrastructure/database/settings-repository';
import type { SqlDriver, SqlValue } from '@/infrastructure/database/sql-driver';

interface NodeSqliteStatement {
  run(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
}
interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
}
declare const require: (id: string) => { DatabaseSync: new (path: string) => NodeSqliteDatabase };
const { DatabaseSync } = require('node:sqlite');

function createDriver(): SqlDriver & { raw: NodeSqliteDatabase } {
  const raw = new DatabaseSync(':memory:');
  const driver: SqlDriver & { raw: NodeSqliteDatabase } = {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params: SqlValue[] = []) {
      return raw.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[] = []) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('SAVEPOINT tx');
      try {
        await task();
        raw.exec('RELEASE tx');
      } catch (error) {
        raw.exec('ROLLBACK TO tx');
        raw.exec('RELEASE tx');
        throw error;
      }
    },
  };
  return driver;
}

async function createRepos() {
  const db = createDriver();
  await runMigrations(db);
  let clock = 1_000;
  let id = 0;
  const presets = new PresetsRepository(
    db,
    () => (clock += 10),
    () => `id-${(id += 1)}`,
  );
  return { db, presets, settings: new SettingsRepository(db) };
}

const input = (name: string) => ({ name, answers: DEFAULT_ANSWERS, coverKey: 'landscape_sunset_horizon' });

describe('SQLite migration', () => {
  it('빈 DB에 전체 migration을 적용하고 버전을 기록한다', async () => {
    const db = createDriver();
    expect(await getSchemaVersion(db)).toBe(0);
    const result = await runMigrations(db);
    expect(result).toEqual({ from: 0, to: MIGRATIONS.length });
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(['meta', 'presets']));
  });

  it('여러 번 실행해도 안전하다(이미 적용된 단계는 건너뛴다)', async () => {
    const db = createDriver();
    await runMigrations(db);
    await new PresetsRepository(db).create(input('유지'));
    const again = await runMigrations(db);
    expect(again.from).toBe(MIGRATIONS.length);
    expect(await new PresetsRepository(db).list()).toHaveLength(1);
  });

  it('새 버전이 추가되면 기존 데이터를 유지한 채 이어서 적용한다', async () => {
    const db = createDriver();
    await runMigrations(db);
    await new PresetsRepository(db).create(input('기존 데이터'));

    const next: Migration[] = [
      ...MIGRATIONS,
      {
        version: MIGRATIONS.length + 1,
        description: '테스트용 열 추가',
        async up(driver) {
          await driver.execAsync('ALTER TABLE presets ADD COLUMN note TEXT');
        },
      },
    ];
    const result = await runMigrations(db, next);
    expect(result).toEqual({ from: MIGRATIONS.length, to: MIGRATIONS.length + 1 });
    const rows = await db.getAllAsync<{ name: string; note: string | null }>('SELECT name, note FROM presets');
    expect(rows).toEqual([{ name: '기존 데이터', note: null }]);
  });

  it('migration이 실패하면 그 단계는 롤백되고 버전이 올라가지 않는다', async () => {
    const db = createDriver();
    await runMigrations(db);
    const broken: Migration[] = [
      ...MIGRATIONS,
      {
        version: MIGRATIONS.length + 1,
        description: '실패하는 단계',
        async up(driver) {
          await driver.execAsync('CREATE TABLE temp_ok (id INTEGER)');
          await driver.execAsync('THIS IS NOT SQL');
        },
      },
    ];
    await expect(runMigrations(db, broken)).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'temp_ok'");
    expect(tables).toHaveLength(0);
  });

  it('앱보다 최신 스키마는 건드리지 않고 오류를 낸다', async () => {
    const db = createDriver();
    await db.execAsync('PRAGMA user_version = 99');
    await expect(runMigrations(db)).rejects.toThrow(/최신/);
  });

  it('버전 번호가 연속적이지 않으면 거부한다', async () => {
    const db = createDriver();
    await expect(
      runMigrations(db, [{ version: 2, description: 'gap', async up() {} }]),
    ).rejects.toThrow(/연속/);
  });
});

describe('프리셋 CRUD', () => {
  it('생성: 첫 프리셋은 자동으로 기본 프리셋이 된다', async () => {
    const { presets } = await createRepos();
    const first = await presets.create(input('첫 번째'));
    const second = await presets.create(input('두 번째'));
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
    expect((await presets.list()).map((preset) => preset.name)).toEqual(['첫 번째', '두 번째']);
    expect((await presets.getDefault())?.id).toBe(first.id);
  });

  it('취향 답변을 그대로 저장하고 읽는다', async () => {
    const { presets, db } = await createRepos();
    const answers = { ...DEFAULT_ANSWERS, mode: 'food' as const, placement: 'right' as const, aspectRatio: '4:5' as const };
    const created = await presets.create({ name: '카페', answers, coverKey: 'cafe_window_table' });
    expect((await presets.get(created.id))?.answers).toEqual(answers);
    const row = await db.getFirstAsync<{ answers_version: number }>('SELECT answers_version FROM presets');
    expect(row?.answers_version).toBe(ANSWERS_VERSION);
  });

  it('수정: 이름·답변·표지가 바뀌고 수정 시각이 갱신된다', async () => {
    const { presets } = await createRepos();
    const created = await presets.create(input('원래 이름'));
    const updated = await presets.update(created.id, {
      name: '새 이름',
      answers: { ...DEFAULT_ANSWERS, size: 'large' },
      coverKey: 'pet_dog_centered',
    });
    expect(updated.name).toBe('새 이름');
    expect(updated.answers.size).toBe('large');
    expect(updated.coverKey).toBe('pet_dog_centered');
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('이름은 공백을 정리하고 길이를 제한하며, 빈 이름은 거부한다', async () => {
    const { presets } = await createRepos();
    const created = await presets.create(input(`   여러   공백   ${'가'.repeat(40)}`));
    expect(created.name.startsWith('여러 공백')).toBe(true);
    expect(created.name.length).toBeLessThanOrEqual(PRESET_NAME_MAX_LENGTH);
    await expect(presets.create(input('   '))).rejects.toThrow();
    await expect(presets.update(created.id, input(''))).rejects.toThrow();
  });

  it('복제: 같은 설정의 새 프리셋을 만든다(기본 지정은 옮기지 않는다)', async () => {
    const { presets } = await createRepos();
    const source = await presets.create(input('원본'));
    const copy = await presets.duplicate(source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('원본 복사본');
    expect(copy.answers).toEqual(source.answers);
    expect(copy.isDefault).toBe(false);
  });

  it('기본값 지정: 항상 하나만 기본이다', async () => {
    const { presets } = await createRepos();
    const a = await presets.create(input('A'));
    const b = await presets.create(input('B'));
    await presets.setDefault(b.id);
    const list = await presets.list();
    expect(list.filter((preset) => preset.isDefault).map((preset) => preset.id)).toEqual([b.id]);
    expect(list.find((preset) => preset.id === a.id)?.isDefault).toBe(false);
  });

  it('삭제: 기본 프리셋을 지우면 남은 첫 프리셋이 기본이 된다', async () => {
    const { presets } = await createRepos();
    const a = await presets.create(input('A'));
    const b = await presets.create(input('B'));
    await presets.remove(a.id);
    const list = await presets.list();
    expect(list.map((preset) => preset.id)).toEqual([b.id]);
    expect(list[0].isDefault).toBe(true);
    await presets.remove(b.id);
    expect(await presets.list()).toEqual([]);
    expect(await presets.getDefault()).toBeNull();
  });

  it('없는 프리셋을 수정/복제/기본 지정하면 오류를 낸다', async () => {
    const { presets } = await createRepos();
    await expect(presets.update('none', input('x'))).rejects.toThrow();
    await expect(presets.duplicate('none')).rejects.toThrow();
    await expect(presets.setDefault('none')).rejects.toThrow();
  });

  it('예시 프리셋은 비어 있을 때만 넣는다', async () => {
    const { presets } = await createRepos();
    await presets.seedBuiltins();
    expect((await presets.list()).map((preset) => preset.name)).toEqual(BUILTIN_PRESET_SEEDS.map((seed) => seed.name));
    await presets.seedBuiltins();
    expect(await presets.list()).toHaveLength(BUILTIN_PRESET_SEEDS.length);
  });

  it('저장된 JSON이 깨져 있어도 기본값으로 읽어 앱이 죽지 않는다', async () => {
    const { presets, db } = await createRepos();
    const created = await presets.create(input('깨짐'));
    await db.runAsync('UPDATE presets SET answers_json = ? WHERE id = ?', ['{not json', created.id]);
    expect((await presets.get(created.id))?.answers).toEqual(DEFAULT_ANSWERS);
  });

  it('구버전(v1) 답변을 읽을 때 현재 스키마로 변환한다', async () => {
    const { presets, db } = await createRepos();
    const created = await presets.create(input('구버전'));
    await db.runAsync('UPDATE presets SET answers_json = ?, answers_version = 1 WHERE id = ?', [
      JSON.stringify({ mode: 'portrait', style: 'closeup', placement: 'center', closeUp: true, level: true, aspectRatio: '3:4', guidanceIntensity: 'normal' }),
      created.id,
    ]);
    const loaded = await presets.get(created.id);
    expect(loaded?.answers.size).toBe('large');
    expect(loaded?.answers.levelGuide).toBe(true);
  });
});

describe('설정 저장 / 데이터 초기화', () => {
  it('저장된 값이 없으면 기본 설정을 돌려준다', async () => {
    const { settings } = await createRepos();
    expect(await settings.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('일부만 바꿔도 나머지는 유지된다', async () => {
    const { settings } = await createRepos();
    await settings.update({ onboardingCompleted: true });
    const next = await settings.update({ hapticsEnabled: false });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, onboardingCompleted: true, hapticsEnabled: false });
    expect(await settings.load()).toEqual(next);
  });

  it('깨진 값·모르는 키는 무시한다', () => {
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ hapticsEnabled: 'no', unknown: 1, gridEnabled: false }))).toEqual({
      ...DEFAULT_SETTINGS,
      gridEnabled: false,
    });
  });

  it('데이터 초기화: 프리셋과 설정이 모두 지워지고 온보딩 전 상태로 돌아간다', async () => {
    const { presets, settings } = await createRepos();
    await presets.seedBuiltins();
    await settings.update({ onboardingCompleted: true, hapticsEnabled: false });
    await presets.removeAll();
    await settings.clear();
    expect(await presets.list()).toEqual([]);
    expect(await settings.load()).toEqual(DEFAULT_SETTINGS);
  });
});
