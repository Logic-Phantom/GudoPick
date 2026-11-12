import type { SqlDriver } from './sql-driver';

export interface Migration {
  /** 1부터 시작하는 연속된 버전 번호 */
  version: number;
  description: string;
  up(db: SqlDriver): Promise<void>;
}

/**
 * 스키마 변경 이력. 이미 배포된 migration은 수정하지 않고 새 버전을 추가한다.
 * 문서: docs/DATA_MODEL.md
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: '설정(meta) 및 프리셋(presets) 테이블 생성',
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS presets (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          answers_json TEXT NOT NULL,
          answers_version INTEGER NOT NULL,
          cover_key TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_presets_sort ON presets (sort_order, created_at);
      `);
    },
  },
];

export async function getSchemaVersion(db: SqlDriver): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * 현재 DB 버전 이후의 migration을 순서대로 적용한다. 각 단계는 트랜잭션으로 묶인다.
 * 앱보다 최신 스키마(다운그레이드)는 건드리지 않고 오류를 던진다.
 */
export async function runMigrations(
  db: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<{ from: number; to: number }> {
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  ordered.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`migration 버전이 연속적이지 않습니다: ${migration.version}`);
    }
  });

  const from = await getSchemaVersion(db);
  const latest = ordered.length;
  if (from > latest) {
    throw new Error(`DB 스키마(v${from})가 앱이 아는 버전(v${latest})보다 최신입니다.`);
  }

  for (const migration of ordered) {
    if (migration.version <= from) continue;
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      // PRAGMA는 바인딩 파라미터를 지원하지 않는다. version은 코드 상수(정수)다.
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
  }
  return { from, to: latest };
}
