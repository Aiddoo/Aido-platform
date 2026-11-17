// 운영 알림이 구독 이벤트의 스토어 ID를 같은 VO로 받는다
export { ProviderEventId } from "./domain/provider-event-id.vo.js";
export { StoreProductId } from "./domain/store-product-id.vo.js";
export { StoreSubscriptionId } from "./domain/store-subscription-id.vo.js";
// 스토어 구독의 엔타이틀먼트 끝 판단. access의 권한·SQL 조건과 identity의 캐시 TTL이 같은 규칙을 쓴다
export {
  STORE_RENEWAL_GRACE_MS,
  storeEntitlementEndsAt,
  storeRenewalGraceEndsAt,
  type StoreEntitlementWindow,
} from "../shared/domain/store-renewal-grace.domain-service.js";
// 여러 사용자를 한 SQL로 고르는 조회가 구독 테이블을 직접 읽지 않고 같은 엔타이틀먼트 규칙을 쓴다
export {
  storeEntitlementExistsCondition,
  storeEntitlementWindows,
  validStoreEntitlementCondition,
} from "./infrastructure/persistence/store-entitlement-conditions.query-fragment.js";
