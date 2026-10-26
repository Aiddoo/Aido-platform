import type {
  UserBlock,
  UserBlockCreationPlan,
} from "../../../domain/aggregates/blocks/user-block.aggregate.js";

export const USER_BLOCK_REPOSITORY = Symbol("USER_BLOCK_REPOSITORY");

/** 차단 목록에 보여 줄 차단 대상 사용자 요약 */
export interface BlockedUserRecord {
  /** 차단 관계 ID. 목록 cursor로 쓴다 */
  id: string;
  blockedAt: Date;
  user: {
    id: string;
    userTag: string;
    profile: { name: string | null; profileImage: string | null } | null;
  };
}

export interface FindBlockedUsersParams {
  blockerId: string;
  cursor?: string;
  size: number;
}

export interface UserBlockRepositoryPort {
  /** 활성 사용자만 차단 대상으로 본다(탈퇴·비활성 제외). */
  userExists(userId: string): Promise<boolean>;
  findByPair(blockerId: string, blockedId: string): Promise<UserBlock | null>;
  create(plan: UserBlockCreationPlan): Promise<UserBlock>;
  /** 지운 차단이 있으면 true. 없던 차단을 해제해도 오류가 아니다. */
  delete(blockerId: string, blockedId: string): Promise<boolean>;
  /**
   * 두 사용자 사이의 친구 관계와 대기 중인 요청을 방향과 상태에 상관없이 모두 지운다.
   * 차단과 같은 UoW에서 실행해 차단이 생긴 뒤 친구 관계가 남지 않게 한다.
   */
  removeFriendshipsBetween(userId: string, otherUserId: string): Promise<number>;
  /** 최근에 차단한 순서로 size+1개까지 읽는다. */
  findBlockedUsers(params: FindBlockedUsersParams): Promise<BlockedUserRecord[]>;
  /** 목록과 같은 조건(탈퇴 중인 사용자 제외)으로 센다. */
  countBlockedUsers(blockerId: string): Promise<number>;
}
