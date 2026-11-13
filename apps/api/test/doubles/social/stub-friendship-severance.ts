import { FriendshipSeverancePort } from "#api/modules/social/friends/social-friends.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface FriendshipEdge {
  readonly followerId: string;
  readonly followingId: string;
}

// 방향 있는 관계 행만 들고 차단이 두 사람 사이 관계를 지우는 결과만 흉내 낸다
export class StubFriendshipSeverance extends FriendshipSeverancePort {
  #edges: FriendshipEdge[] = [];

  get friendshipCount(): number {
    return this.#edges.length;
  }

  seedFriendship(followerId: string, followingId: string): void {
    this.#edges.push({ followerId, followingId });
  }

  async severBetween(userId: UserId, otherUserId: UserId): Promise<number> {
    const isBetween = (edge: FriendshipEdge) =>
      (edge.followerId === userId.value && edge.followingId === otherUserId.value) ||
      (edge.followerId === otherUserId.value && edge.followingId === userId.value);
    const removedCount = this.#edges.filter(isBetween).length;
    this.#edges = this.#edges.filter((edge) => !isBetween(edge));
    return removedCount;
  }
}
