import type { PlanFeature } from "@aido/api/vocabulary";

/** 설정 기능(사용자 지정 알림 시각 등)을 쓸 수 있는지 묻는다. access의 권한 판단을 그대로 쓴다 */
export abstract class PreferenceEntitlementPort {
  abstract can(userId: string, feature: PlanFeature): Promise<boolean>;
}
