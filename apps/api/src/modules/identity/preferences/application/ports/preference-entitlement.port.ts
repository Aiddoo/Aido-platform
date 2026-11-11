import type { PlanFeature } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 설정 기능(사용자 지정 알림 시각 등)을 쓸 수 있는지 묻는다. access의 권한 판단을 그대로 쓴다 */
export abstract class PreferenceEntitlementPort {
  abstract can(userId: UserId, feature: PlanFeature): Promise<boolean>;
}
