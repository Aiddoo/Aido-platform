import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";

import { ENTITLEMENT_DATABASE } from "../entitlements/application/ports/access-state.reader.port.js";
import { QUOTA_LEDGER_REPOSITORY } from "./application/ports/quota-ledger.repository.port.js";
import { QUOTA_USER_MUTATION_LOCK } from "./application/ports/quota-user-mutation-lock.port.js";
import { QuotaLedgerService } from "./infrastructure/adapters/quota-ledger.adapter.js";

type QuotaLedgerDependencies = ConstructorParameters<typeof QuotaLedgerService>[0];

export const quotaLedgerServiceProvider: FactoryProvider<QuotaLedgerService> = {
  provide: QuotaLedgerService,
  inject: [
    QUOTA_LEDGER_REPOSITORY,
    QUOTA_USER_MUTATION_LOCK,
    ENTITLEMENT_DATABASE,
    UNIT_OF_WORK,
    OPERATIONAL_ALERT,
  ],
  useFactory: (
    repository: QuotaLedgerDependencies["repository"],
    userMutationLock: QuotaLedgerDependencies["userMutationLock"],
    resourceBonuses: QuotaLedgerDependencies["resourceBonuses"],
    unitOfWork: QuotaLedgerDependencies["unitOfWork"],
    alert: QuotaLedgerDependencies["alert"],
  ) =>
    new QuotaLedgerService({
      repository,
      userMutationLock,
      resourceBonuses,
      unitOfWork,
      alert,
      logger: new Logger(QuotaLedgerService.name),
    }),
};
