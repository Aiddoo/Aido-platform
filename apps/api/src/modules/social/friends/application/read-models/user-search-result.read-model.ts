import type { FriendUserReadModel } from "./friend.read-model.js";

// 관계 flag는 검색한 사람 기준이다. rank는 다음 페이지 커서에만 쓰는 관련도 묶음이다
// (0 태그 정확 일치, 1 태그 앞부분, 2 이름 앞부분, 3 부분 일치)
export interface UserSearchResultReadModel {
  readonly user: FriendUserReadModel;
  readonly isFollowing: boolean;
  readonly isFollower: boolean;
  readonly isFriend: boolean;
  readonly isRequestPending: boolean;
  readonly rank: number;
}
