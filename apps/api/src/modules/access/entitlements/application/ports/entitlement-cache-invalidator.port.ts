import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/**
 * 권한 판단에 쓰는 사용자 상태(구독·보상 기간·역할·받은 자리)가 바뀐 사용자의 권한 캐시를 비운다.
 * 바꾼 쪽이 커밋 뒤에 부른다.
 */
export abstract class EntitlementCacheInvalidatorPort {
  abstract invalidateEntitlements(userId: UserId): Promise<void>;
}
