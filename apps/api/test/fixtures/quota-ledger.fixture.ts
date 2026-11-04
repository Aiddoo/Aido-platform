import { mock } from "vitest-mock-extended";

import { QuotaLedgerService } from "#api/modules/access/application/services/quotas/quota-ledger.service";
import { NO_RESOURCE_BONUSES } from "#api/modules/access/domain/policies/entitlement/entitlement.policy";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import {
  InMemoryQuotaLedgerRepository,
  type InMemoryQuotaUser,
  StubQuotaUserMutationLock,
} from "#test/mocks/ports/quota-ledger.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { UserFixture } from "./user.fixture.js";

export const QUOTA_LEDGER_TIME = new Date("2026-04-12T12:00:00Z");

/** 메모리 저장소 위의 실제 QuotaLedgerService. 사용 Context의 UseCase 테스트도 이 원장을 쓴다. */
export function createQuotaLedgerFixture(input: Partial<InMemoryQuotaUser> = {}) {
  const user = UserFixture.create();
  const repository = new InMemoryQuotaLedgerRepository();
  repository.users.set(user.id, {
    role: "USER",
    subscriptionStatus: "FREE",
    accessDeadline: null,
    aiUsageCount: 0,
    aiUsageResetAt: new Date(QUOTA_LEDGER_TIME),
    ...input,
  });
  const userMutationLock = new StubQuotaUserMutationLock(repository);
  const unitOfWork = createUnitOfWorkMock();
  const ledgerLogger = mock<ApplicationLogger>();
  const alert = mock<OperationalAlertPort>();
  const ledger = new QuotaLedgerService({
    repository,
    userMutationLock,
    resourceBonuses: { findResourceBonuses: async () => NO_RESOURCE_BONUSES },
    unitOfWork,
    alert,
    logger: ledgerLogger,
  });
  return { userId: user.id, repository, unitOfWork, ledgerLogger, alert, ledger };
}
