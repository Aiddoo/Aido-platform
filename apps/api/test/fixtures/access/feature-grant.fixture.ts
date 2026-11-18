import {
  FeatureGrant,
  type FeatureGrantPrimitives,
} from "#api/modules/access/feature-grants/domain/feature-grant.aggregate";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import { ACCESS_FIXTURE_NOW, ACCESS_FIXTURE_USER_ID } from "./access-user.fixture.js";

/** 초대 보상으로 받은 친구 자리 하나 */
export function createFeatureGrantFixture(
  overrides: Partial<FeatureGrantPrimitives> = {},
): FeatureGrant {
  return FeatureGrant.reconstitute({
    id: createEntityId(),
    userId: ACCESS_FIXTURE_USER_ID,
    feature: "FRIEND",
    quantity: 1,
    sourceKey: "invite:1",
    createdAt: ACCESS_FIXTURE_NOW,
    ...overrides,
  });
}
