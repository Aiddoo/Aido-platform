import { TransactionHost } from "@nestjs-cls/transactional";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsModule } from "nestjs-cls";

import {
  AFTER_COMMIT_TASK_REGISTRY,
  type AfterCommitTaskRegistryPort,
  UNIT_OF_WORK,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { ClsUnitOfWork } from "./cls-unit-of-work.js";
import { DatabaseModule } from "./database.module.js";
import { DatabaseService } from "./database.service.js";
import { PostgresPool } from "./postgres-pool.js";

const transactionHost = {
  isTransactionActive: () => false,
  withTransaction: <T>(work: () => Promise<T>) => work(),
};

@Global()
@Module({
  providers: [{ provide: TransactionHost, useValue: transactionHost }],
  exports: [TransactionHost],
})
class TestTransactionHostModule {}

describe("DatabaseModule", () => {
  it("UoW와 after-commit registry 토큰에 같은 ClsUnitOfWork singleton을 제공한다", async () => {
    const module = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true }), TestTransactionHostModule, DatabaseModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({})
      .overrideProvider(PostgresPool)
      .useValue({})
      .compile();

    const concrete = module.get(ClsUnitOfWork);
    const unitOfWork = module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const registry = module.get<AfterCommitTaskRegistryPort>(AFTER_COMMIT_TASK_REGISTRY);

    expect(unitOfWork).toBe(concrete);
    expect(registry).toBe(concrete);
    await module.close();
  });
});
