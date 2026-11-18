import type { Provider } from "@nestjs/common";

import { QuotaUsageRepositoryPort } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import { OwnedFeatureUsageReaderPort } from "./application/ports/owned-feature-usage.reader.port.js";
import { GetEntitlementUsageUseCase } from "./application/use-cases/get-entitlement-usage.use-case.js";
import { OwnedFeatureUsageReaderAdapter } from "./infrastructure/adapters/owned-feature-usage-reader.adapter.js";

export const ACCESS_FEATURE_GRANTS_PROVIDERS = [
  { provide: OwnedFeatureUsageReaderPort, useClass: OwnedFeatureUsageReaderAdapter },
  provideUseCase(GetEntitlementUsageUseCase, {
    accessStateReader: AccessStateReaderPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    ownedFeatureUsageReader: OwnedFeatureUsageReaderPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
