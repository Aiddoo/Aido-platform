import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanningContextReadModel } from "../read-models/planning-context.read-model.js";

export abstract class PlanningContextReaderPort {
  abstract read(userId: UserId, timezone: string): Promise<PlanningContextReadModel>;
  abstract listOwnedCategoryIds(userId: UserId): Promise<ReadonlySet<number>>;
}
