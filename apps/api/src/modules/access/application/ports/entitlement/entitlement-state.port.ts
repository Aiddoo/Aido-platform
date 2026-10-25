import type { ResourceBonuses } from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

export interface EntitlementUserState {
  readonly role: string;
  /** User의 구독 projection 그대로의 상태 */
  readonly subscriptionStatus: string;
  /** ACTIVE projection이 끝나는 시각. null이면 웹훅이 바꿀 때까지 유지한다. */
  readonly accessDeadline: Date | null;
}

export const ENTITLEMENT_DATABASE = Symbol("ENTITLEMENT_DATABASE");

export interface EntitlementDatabasePort {
  findUserState(userId: string): Promise<EntitlementUserState | null>;
  /** 리소스별 보너스 합계. 없으면 0이다. */
  findResourceBonuses(userId: string): Promise<ResourceBonuses>;
}
