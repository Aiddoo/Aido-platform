// 옛 Symbol 토큰. billing이 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭으로 남긴다
export const ENTITLEMENT_SUBSCRIPTION_INVALIDATOR = Symbol("ENTITLEMENT_SUBSCRIPTION_INVALIDATOR");

/** 구독·보상 상태가 바뀐 사용자의 권한 캐시를 비운다. */
export abstract class EntitlementSubscriptionInvalidatorPort {
  abstract invalidateSubscription(userId: string): Promise<void>;
}
