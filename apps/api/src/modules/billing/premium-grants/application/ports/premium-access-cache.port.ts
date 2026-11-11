import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/**
 * 프리미엄 캐시 무효화 포트.
 *
 * 구독·보상 기간이 바뀌면 사용자 구독·프로필 캐시를 무효화한다(키·TTL은 캐시 소유 Context가 정한다).
 */
export abstract class PremiumAccessCachePort {
  abstract invalidate(userId: UserId): Promise<void>;
}
