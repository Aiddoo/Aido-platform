import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 차단처럼 두 사람 사이를 끊을 때 친구 관계와 대기 요청을 방향·상태와 상관없이 지운다.
// 호출자 UoW 안에서 FriendLockKeys 쌍·목록 잠금을 잡은 뒤 부르고, 친구 캐시는 커밋 뒤 비운다
export abstract class FriendshipSeverancePort {
  abstract severBetween(userId: UserId, otherUserId: UserId): Promise<number>;
}
