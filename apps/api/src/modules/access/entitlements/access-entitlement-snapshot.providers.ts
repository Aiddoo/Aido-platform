import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { QuotaUsageRepositoryPort } from "../quotas/application/ports/quota-usage.repository.port.js";
import { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
import { OwnedFeatureUsageReaderPort } from "./application/ports/owned-feature-usage.reader.port.js";
import { GetEntitlementSnapshotUseCase } from "./application/use-cases/get-entitlement-snapshot.use-case.js";
import { OwnedFeatureUsageReaderAdapter } from "./infrastructure/adapters/owned-feature-usage-reader.adapter.js";

export const ACCESS_ENTITLEMENT_SNAPSHOT_PROVIDERS = [
  { provide: OwnedFeatureUsageReaderPort, useClass: OwnedFeatureUsageReaderAdapter },
  provideUseCase(GetEntitlementSnapshotUseCase, {
    accessStateReader: AccessStateReaderPort,
    quotaUsageRepository: QuotaUsageRepositoryPort,
    ownedFeatureUsageReader: OwnedFeatureUsageReaderPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
