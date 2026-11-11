import { TransactionHost } from "@nestjs-cls/transactional";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";

import { databaseConfig } from "#api/platform/config/database.config";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { ClsUnitOfWork } from "./cls-unit-of-work.js";
import { DatabaseModule } from "./database.module.js";

const transactionHost = {
  isTransactionActive: () => false,
  withTransaction: <T>(work: () => Promise<T>) => work(),
};

// pg Pool은 첫 쿼리 전까지 연결하지 않아 조립만 볼 때 실제 DB가 필요 없다
const database = { url: "postgresql://unused:unused@localhost:5432/unused", poolMax: 1 };

@Global()
@Module({
  providers: [
    { provide: TransactionHost, useValue: transactionHost },
    { provide: databaseConfig.KEY, useValue: database },
  ],
  exports: [TransactionHost, databaseConfig.KEY],
})
class TestInfrastructureModule {}

describe("DatabaseModule", () => {
  it("UoW와 after-commit registry 토큰에 같은 ClsUnitOfWork singleton을 제공한다", async () => {
    const module = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true }), TestInfrastructureModule, DatabaseModule],
    }).compile();

    const concrete = module.get(ClsUnitOfWork);
    const unitOfWork = module.get(UnitOfWorkPort);
    const registry = module.get(AfterCommitTaskRegistryPort);

    expect(unitOfWork).toBe(concrete);
    expect(registry).toBe(concrete);
    await module.close();
  });
});
