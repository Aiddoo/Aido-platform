import { mock } from "vitest-mock-extended";

import type { AiQuotaState } from "#api/modules/access/application/ports/quotas/ai-quota.repository.port";
import { AiQuotaService } from "#api/modules/access/application/services/quotas/ai-quota.service";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { FakeAiProvider } from "#test/mocks/fake-ai.provider";
import {
  StubAiQuotaRepository,
  StubAiQuotaUserMutationLock,
  StubAiUserCategoryReader,
} from "#test/mocks/ports/ai-quota.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { UserFixture } from "./user.fixture.js";

export const AI_QUOTA_TIME = new Date("2026-04-12T12:00:00Z");
export function createAiQuotaFixture(input: Partial<AiQuotaState> = {}) {
  const user = UserFixture.create();
  const repository = new StubAiQuotaRepository();
  repository.users.set(user.id, {
    role: "USER",
    subscriptionStatus: "FREE",
    count: 0,
    resetAt: new Date(AI_QUOTA_TIME),
    ...input,
  });
  const userMutationLock = new StubAiQuotaUserMutationLock(repository);
  const unitOfWork = createUnitOfWorkMock();
  const logger = mock<ApplicationLogger>();
  const quota = new AiQuotaService({ repository, userMutationLock, unitOfWork, logger });
  const categoryReader = new StubAiUserCategoryReader();
  categoryReader.categories.set(user.id, [{ id: 7, name: "업무" }]);
  const aiProvider = new FakeAiProvider();
  return {
    userId: user.id,
    repository,
    userMutationLock,
    unitOfWork,
    logger,
    quota,
    categoryReader,
    aiProvider,
  };
}
