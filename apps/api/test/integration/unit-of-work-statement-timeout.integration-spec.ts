import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { ClsModule } from "nestjs-cls";

import { databaseConfig } from "#api/platform/config/database.config";
import { classifyDatabaseError } from "#api/platform/database/database-error.util";
import { DRIZZLE, type DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { DatabaseModule } from "#api/platform/database/database.module";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

// DrizzleModule이 만드는 기본 pool은 DRIZZLE을 테스트 client로 덮어써 쓰이지 않는다
@Global()
@Module({
  providers: [
    {
      provide: databaseConfig.KEY,
      useValue: { url: "postgresql://unused:unused@localhost:5432/unused", poolMax: 1 },
    },
  ],
  exports: [databaseConfig.KEY],
})
class TestConfigModule {}

describe("UoW 작업별 쿼리 시간 제한 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let module: TestingModule;
  let unitOfWork: UnitOfWorkPort;
  let txHost: TransactionHost<DrizzleTransactionalAdapter>;

  beforeAll(async () => {
    // 연결 하나로 묶어 SET LOCAL이 다음 트랜잭션으로 새지 않는지도 같은 세션에서 본다
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 1 }) });
    const client = await database.start();
    module = await Test.createTestingModule({
      imports: [
        TestConfigModule,
        DatabaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
            }),
          ],
        }),
      ],
    })
      .overrideProvider(DRIZZLE)
      .useValue(client)
      .compile();
    await module.init();
    unitOfWork = module.get(UnitOfWorkPort);
    txHost = module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
  });

  afterAll(async () => {
    await module?.close();
    await database?.stop();
  });

  it("statementTimeoutMs를 넘는 쿼리는 문장 시간 초과로 분류된다", async () => {
    // When
    const error = await unitOfWork
      .run(async () => txHost.tx.execute(sql`SELECT pg_sleep(0.5)`), { statementTimeoutMs: 100 })
      .then(
        () => null,
        (rejection: unknown) => rejection,
      );

    // Then
    expect(classifyDatabaseError(error)).toBe("statement-timeout");
  });

  it("옵션 없는 UoW는 짧은 제한이 남지 않아 같은 연결에서 같은 쿼리가 통과한다", async () => {
    // Given
    await unitOfWork
      .run(async () => txHost.tx.execute(sql`SELECT pg_sleep(0.5)`), { statementTimeoutMs: 100 })
      .catch(() => undefined);

    // When
    const result = await unitOfWork.run(async () => {
      await txHost.tx.execute(sql`SELECT pg_sleep(0.5)`);
      return txHost.tx.execute<{ statement_timeout: string }>(sql`SHOW statement_timeout`);
    });

    // Then
    expect(result.rows[0]?.statement_timeout).toEqual(expect.any(String));
    expect(result.rows[0]?.statement_timeout).not.toBe("100ms");
  });
});
