import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { ENTITLEMENT_DATABASE } from "./application/ports/entitlement/entitlement-state.port.js";
import { QUOTA_LEDGER_REPOSITORY } from "./application/ports/quotas/quota-ledger.repository.port.js";
import { QUOTA_USER_MUTATION_LOCK } from "./application/ports/quotas/quota-user-mutation-lock.port.js";
import { QuotaLedgerService } from "./application/services/quotas/quota-ledger.service.js";

type QuotaLedgerDependencies = ConstructorParameters<typeof QuotaLedgerService>[0];

export const quotaLedgerServiceProvider: FactoryProvider<QuotaLedgerService> = {
  provide: QuotaLedgerService,
  inject: [QUOTA_LEDGER_REPOSITORY, QUOTA_USER_MUTATION_LOCK, ENTITLEMENT_DATABASE, UNIT_OF_WORK],
  useFactory: (
    repository: QuotaLedgerDependencies["repository"],
    userMutationLock: QuotaLedgerDependencies["userMutationLock"],
    resourceBonuses: QuotaLedgerDependencies["resourceBonuses"],
    unitOfWork: QuotaLedgerDependencies["unitOfWork"],
  ) =>
    new QuotaLedgerService({
      repository,
      userMutationLock,
      resourceBonuses,
      unitOfWork,
      logger: new Logger(QuotaLedgerService.name),
    }),
};
