/** Managed PostgreSQL test client. Global setup owns containers and native migration graphs. */
import postgres from "@prisma/orm-postgres/runtime";
import { raw } from "sql-template-tag";

import type { Contract } from "../../src/generated/prisma8/contract.d.js";
import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import { sqlStatement } from "../../src/platform/database/database-sql.js";
import { utcTimestampParameters } from "../../src/platform/database/database-timestamp.middleware.js";
import type { DatabaseService } from "../../src/platform/database/database.service.js";
import { databaseSqlState } from "../../src/platform/database/prisma-error.util.js";
import { assertManagedTestDatabaseEnvironment } from "./managed-test-database.js";

export type TestDatabaseClient = DatabaseService["db"];

/** 교착으로 튕긴 TRUNCATE를 다시 시도하는 횟수. */
const TRUNCATE_MAX_ATTEMPTS = 3;

/** 재시도 간격의 기준값. 시도마다 선형으로 늘려 경합이 풀릴 틈을 준다. */
const TRUNCATE_RETRY_BASE_MS = 250;

/** PostgreSQL `deadlock_detected`. 이것만 재시도하고, 나머지 실패는 그대로 올린다. */
const DEADLOCK_DETECTED = "40P01";

function isDeadlock(error: unknown): boolean {
  return databaseSqlState(error) === DEADLOCK_DETECTED;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface TestDatabaseOptions {
  env?: NodeJS.ProcessEnv;
  createClient?: (connectionUri: string) => TestDatabaseClient;
}

export class TestDatabase {
  private client: TestDatabaseClient | null = null;
  private connectionUri: string | null = null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly createClient: (connectionUri: string) => TestDatabaseClient;

  constructor(options: TestDatabaseOptions = {}) {
    this.env = options.env ?? process.env;
    this.createClient =
      options.createClient ??
      ((connectionUri) =>
        postgres<Contract>({
          contractJson,
          url: connectionUri,
          middleware: [utcTimestampParameters],
        }));
  }

  /**
   * globalSetup이 준비한 PostgreSQL에 Prisma 클라이언트 연결
   *
   * @returns TestDatabaseClient 인스턴스
   */
  async start(): Promise<TestDatabaseClient> {
    if (this.client) return this.client;

    const { connectionUri } = assertManagedTestDatabaseEnvironment(this.env);
    this.connectionUri = connectionUri;
    this.client = this.createClient(connectionUri);

    await this.client
      .runtime()
      .query(this.client.raw.sql`SELECT 1 AS value`.returnsRow({ value: "pg/int4@1" }).build());

    return this.client;
  }

  /**
   * Prisma 클라이언트 반환
   */
  getClient(): TestDatabaseClient {
    if (!this.client) {
      throw new Error("TestDatabase not started. Call start() first.");
    }
    return this.client;
  }

  /**
   * 관리형 테스트 DB 연결 URI 반환
   */
  getConnectionUri(): string {
    if (!this.connectionUri) {
      throw new Error("TestDatabase not started. Call start() first.");
    }
    return this.connectionUri;
  }

  /**
   * 테스트 데이터 초기화 (모든 테이블 데이터 삭제)
   */
  async cleanup(): Promise<void> {
    if (!this.client) {
      return;
    }

    assertManagedTestDatabaseEnvironment(this.env);
    const tables = await this.client.runtime().query(
      this.client.raw.sql`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_type = 'BASE TABLE'
			ORDER BY table_name
  `
        .returnsRow({ table_name: "pg/text@1" })
        .build(),
    );

    if (tables.length === 0) return;

    const tableList = tables
      .map(({ table_name }) => `"public"."${table_name.replaceAll('"', '""')}"`)
      .join(", ");
    await this.#truncate(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  }

  /**
   * TRUNCATE는 대상 테이블에 ACCESS EXCLUSIVE 락을 잡는다. 앞 테스트가 남긴 작업이
   * 아직 같은 테이블을 쥐고 있으면 교착(40P01)으로 튕길 수 있다 — 드문 경합이지
   * 설계 결함이 아니므로, 물러섰다 다시 잡는다.
   *
   * 시간 상한으로 죽이지 않는 이유: 정상적으로 조금 오래 걸리는 정리까지 함께 죽고,
   * 실패가 "무엇이 잘못됐는지" 대신 "느렸다"만 말하게 된다.
   */
  async #truncate(statement: string): Promise<void> {
    const client = this.getClient();

    for (let attempt = 1; attempt <= TRUNCATE_MAX_ATTEMPTS; attempt += 1) {
      try {
        await client
          .runtime()
          .execute(sqlStatement(client, raw(statement)).affectedCount().build());
        return;
      } catch (error) {
        const isLastAttempt = attempt === TRUNCATE_MAX_ATTEMPTS;
        if (isLastAttempt || !isDeadlock(error)) {
          throw error;
        }
        await delay(TRUNCATE_RETRY_BASE_MS * attempt);
      }
    }
  }

  /**
   * Prisma 클라이언트 연결 해제
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.connectionUri = null;
  }
}

/**
 * 테스트에서 사용할 전역 TestDatabase 인스턴스 생성 헬퍼
 */
export const createTestDatabase = () => new TestDatabase();
