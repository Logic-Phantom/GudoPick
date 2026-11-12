import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';
import type { SqlDriver, SqlValue } from './sql-driver';

const DATABASE_NAME = 'gudopick.db';

let opening: Promise<SqlDriver> | null = null;

/** 기기 로컬 SQLite를 열고 migration을 적용한다. 앱 전체에서 한 번만 연다. */
export function openAppDatabase(): Promise<SqlDriver> {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      const driver: SqlDriver = {
        execAsync: (sql) => db.execAsync(sql),
        runAsync: (sql, params: SqlValue[] = []) => db.runAsync(sql, params),
        getAllAsync: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
        getFirstAsync: <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
        withTransactionAsync: (task) => db.withTransactionAsync(task),
      };
      await runMigrations(driver);
      return driver;
    })().catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}
