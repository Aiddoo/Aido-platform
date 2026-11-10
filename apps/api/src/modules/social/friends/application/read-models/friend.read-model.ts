export interface FriendUserReadModel {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

// user는 상대방이다. friendsSince는 내 방향 관계가 마지막으로 바뀐 시각(updatedAt)이다
export interface FriendReadModel {
  readonly friendshipId: string;
  readonly user: FriendUserReadModel;
  readonly friendsSince: Temporal.Instant;
}

// 받은 요청이면 user는 보낸 사람, 보낸 요청이면 받는 사람이다
export interface FriendRequestReadModel {
  readonly friendshipId: string;
  readonly user: FriendUserReadModel;
  readonly requestedAt: Temporal.Instant;
}
