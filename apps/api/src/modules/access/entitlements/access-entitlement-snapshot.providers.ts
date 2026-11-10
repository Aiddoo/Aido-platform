import { type FactoryProvider } from "@nestjs/common";

import { TODO_CATEGORY_COUNT_READER } from "#api/modules/planning/categories/planning-categories.public";
import { CHEER_USAGE_READER } from "#api/modules/social/cheers/social-cheers.public";
import { FRIEND_COUNT_READER } from "#api/modules/social/friends/social-friends.public";
import { NUDGE_USAGE_READER } from "#api/modules/social/nudges/social-nudges.public";

import { QUOTA_LEDGER } from "../quotas/application/ports/quota-ledger.port.js";
import { GetEntitlementSnapshotUseCase } from "./application/use-cases/get-entitlement-snapshot.use-case.js";

type GetEntitlementSnapshotDependencies = ConstructorParameters<
  typeof GetEntitlementSnapshotUseCase
>[0];

export const getEntitlementSnapshotProvider: FactoryProvider<GetEntitlementSnapshotUseCase> = {
  provide: GetEntitlementSnapshotUseCase,
  inject: [
    QUOTA_LEDGER,
    CHEER_USAGE_READER,
    NUDGE_USAGE_READER,
    FRIEND_COUNT_READER,
    TODO_CATEGORY_COUNT_READER,
  ],
  useFactory: (
    quotaLedger: GetEntitlementSnapshotDependencies["quotaLedger"],
    cheerUsageReader: GetEntitlementSnapshotDependencies["cheerUsageReader"],
    nudgeUsageReader: GetEntitlementSnapshotDependencies["nudgeUsageReader"],
    friendCountReader: GetEntitlementSnapshotDependencies["friendCountReader"],
    categoryCountReader: GetEntitlementSnapshotDependencies["categoryCountReader"],
  ) =>
    new GetEntitlementSnapshotUseCase({
      quotaLedger,
      cheerUsageReader,
      nudgeUsageReader,
      friendCountReader,
      categoryCountReader,
    }),
};
