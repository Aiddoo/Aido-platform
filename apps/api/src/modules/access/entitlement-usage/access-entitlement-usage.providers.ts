import type { Provider } from "@nestjs/common";

import { AccessStateReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { QuotaUsageRepositoryPort } from "#api/modules/access/quotas/access-quotas.public";
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { OwnedFeatureUsageReaderPort } from "./application/ports/owned-feature-usage.reader.port.js";
import { GetEntitlementUsageUseCase } from "./application/use-cases/get-entitlement-usage.use-case.js";
import { OwnedFeatureUsageReaderAdapter } from "./infrastructure/adapters/owned-feature-usage-reader.adapter.js";

export const ACCESS_ENTITLEMENT_USAGE_PROVIDERS = [
  { provide: OwnedFeatureUsageReaderPort, useClass: OwnedFeatureUsageReaderAdapter },
  provideUseCase(GetEntitlementUsageUseCase, {
    accessStateReader: AccessStateReaderPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    ownedFeatureUsageReader: OwnedFeatureUsageReaderPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
