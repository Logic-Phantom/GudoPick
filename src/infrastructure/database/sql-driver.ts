export type SqlValue = string | number | null;

/**
 * 저장소 계층이 의존하는 최소 SQL 인터페이스.
 * 앱에서는 expo-sqlite, 테스트에서는 node:sqlite로 구현한다.
 */
export interface SqlDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
