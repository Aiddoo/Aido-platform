export interface EstablishFriendshipInput {
  readonly requesterId: string;
  readonly targetUserId: string;
  /** 초대처럼 호출자가 자기 알림을 따로 보낼 때 친구 성립 알림을 생략한다. 친구 요청 알림은 항상 보낸다. */
  readonly shouldNotifyFriends: boolean;
}

/**
 * FRIENDS: 서로 친구가 됨, REQUESTED: 상대 자리가 꽉 차 친구 요청만 보냄,
 * ALREADY_FRIENDS: 바뀐 것 없음, UNAVAILABLE: 요청한 사람 자리가 꽉 참
 */
export type FriendshipEstablishment = "FRIENDS" | "REQUESTED" | "ALREADY_FRIENDS" | "UNAVAILABLE";

export const FRIENDSHIP_ESTABLISHER = Symbol("FRIENDSHIP_ESTABLISHER");

/** 친구 요청·수락 없이 바로 친구를 맺는다. 호출자의 UoW에 참여하고 알림은 커밋 뒤 보낸다. */
export interface FriendshipEstablisherPort {
  establish(input: EstablishFriendshipInput): Promise<FriendshipEstablishment>;
}
