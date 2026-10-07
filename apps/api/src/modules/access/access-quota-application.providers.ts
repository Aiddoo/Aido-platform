import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { AI_QUOTA_USER_MUTATION_LOCK } from "./application/ports/quotas/ai-quota-user-mutation-lock.port.js";
import { AI_QUOTA_REPOSITORY } from "./application/ports/quotas/ai-quota.repository.port.js";
import { AiQuotaService } from "./application/services/quotas/ai-quota.service.js";

export const aiQuotaServiceProvider: FactoryProvider<AiQuotaService> = {
  provide: AiQuotaService,
  inject: [AI_QUOTA_REPOSITORY, AI_QUOTA_USER_MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof AiQuotaService>[0]["repository"],
    userMutationLock: ConstructorParameters<typeof AiQuotaService>[0]["userMutationLock"],
    unitOfWork: ConstructorParameters<typeof AiQuotaService>[0]["unitOfWork"],
  ) =>
    new AiQuotaService({
      repository,
      userMutationLock,
      unitOfWork,
      logger: new Logger(AiQuotaService.name),
    }),
};
