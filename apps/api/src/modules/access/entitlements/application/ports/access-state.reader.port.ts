import type { ResourceBonuses } from "../../domain/entitlement.domain-service.js";

export interface ActiveUserAccessState {
  readonly role: string;
  /** User의 구독 projection 그대로의 상태 */
  readonly subscriptionStatus: string;
  /** ACTIVE projection이 끝나는 시각. null이면 웹훅이 바꿀 때까지 유지한다. */
  readonly accessDeadline: Date | null;
}

export const ACCESS_STATE_READER = Symbol("ACCESS_STATE_READER");

export interface AccessStateReaderPort {
  findUserState(userId: string): Promise<ActiveUserAccessState | null>;
  /** 리소스별 보너스 합계. 없으면 0이다. */
  findResourceBonuses(userId: string): Promise<ResourceBonuses>;
}
