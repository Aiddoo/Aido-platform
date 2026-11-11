/** Managed PostgreSQL test client. Global setup owns containers and migrations. */
import { sql } from "drizzle-orm";

import { databaseSqlState } from "../../src/platform/database/database-error.util.js";
import { createTestClient, type TestDatabaseClient } from "./database-context.js";
import { assertManagedTestDatabaseEnvironment } from "./managed-test-database.js";

export type { TestDatabaseClient } from "./database-context.js";

/** PostgreSQL `insufficient_privilege`. superuser가 아니면 FK 트리거를 끌 수 없다. */
const INSUFFICIENT_PRIVILEGE = "42501";

/**
 * 모든 public 테이블을 비우고 serial 시퀀스를 처음 값으로 되돌린다(RESTART IDENTITY와 같은 결과).
 * FK 트리거를 끈 DELETE는 빈 테이블 파일을 교체하는 TRUNCATE보다 테스트 규모에서 훨씬 빠르다.
 */
const RESET_ALL_TABLES = sql`
  DO $$
  DECLARE target record;
  BEGIN
    SET LOCAL session_replication_role = replica;
    FOR target IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('DELETE FROM %I.%I', target.schemaname, target.tablename);
    END LOOP;
    FOR target IN SELECT schemaname, sequencename, start_value FROM pg_sequences WHERE schemaname = 'public' LOOP
      EXECUTE format('SELECT setval(%L, %s, false)', format('%I.%I', target.schemaname, target.sequencename), target.start_value);
    END LOOP;
  END $$
`;

const TRUNCATE_ALL_TABLES = sql`
  DO $$
  DECLARE tables text;
  BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
    FROM pg_tables WHERE schemaname = 'public';
    IF tables IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
    END IF;
  END $$
`;

interface TestDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  createClient?: (connectionUri: string) => TestDatabaseClient;
}

export class TestDatabase {
  #client: TestDatabaseClient | null = null;
  #connectionUri: string | null = null;
  #canDisableTriggers = true;
  readonly #env: NodeJS.ProcessEnv;
  readonly #createClient: (connectionUri: string) => TestDatabaseClient;

  constructor(options: TestDatabaseOptions = {}) {
    this.#env = options.env ?? process.env;
    this.#createClient =
      options.createClient ?? ((connectionUri) => createTestClient(connectionUri));
  }

  /**
   * globalSetup이 준비한 PostgreSQL에 연결
   *
   * @returns TestDatabaseClient 인스턴스
   */
  async start(): Promise<TestDatabaseClient> {
    if (this.#client) {
      return this.#client;
    }

    const { connectionUri } = assertManagedTestDatabaseEnvironment(this.#env);
    const client = this.#createClient(connectionUri);

    try {
      await client.execute(sql`SELECT 1`);
    } catch (error) {
      // 실패한 연결을 공개하지 않고 부분 자원을 정리한다. 최초 probe 오류를 보존한다.
      await client.close().catch(() => undefined);
      throw error;
    }

    this.#client = client;
    this.#connectionUri = connectionUri;
    return client;
  }

  /**
   * 테스트 DB 클라이언트 반환
   */
  getClient(): TestDatabaseClient {
    if (!this.#client) {
      throw new Error("TestDatabase not started. Call start() first.");
    }
    return this.#client;
  }

  /**
   * 관리형 테스트 DB 연결 URI 반환
   */
  getConnectionUri(): string {
    if (!this.#connectionUri) {
      throw new Error("TestDatabase not started. Call start() first.");
    }
    return this.#connectionUri;
  }

  /**
   * 테스트 데이터 초기화 (모든 테이블 데이터 삭제)
   */
  async cleanup(): Promise<void> {
    if (!this.#client) {
      return;
    }

    assertManagedTestDatabaseEnvironment(this.#env);
    if (this.#canDisableTriggers) {
      try {
        await this.#client.execute(RESET_ALL_TABLES);
        return;
      } catch (error) {
        if (databaseSqlState(error) !== INSUFFICIENT_PRIVILEGE) {
          throw error;
        }
        this.#canDisableTriggers = false;
      }
    }
    await this.#client.execute(TRUNCATE_ALL_TABLES);
  }

  /**
   * 테스트 DB 연결 해제
   */
  async stop(): Promise<void> {
    if (this.#client) {
      await this.#client.close();
      this.#client = null;
    }
    this.#connectionUri = null;
  }
}
