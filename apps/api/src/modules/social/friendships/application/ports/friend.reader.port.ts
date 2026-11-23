import type { CursorPage } from "#api/shared/application/cursor-page";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FriendshipId } from "../../domain/friendship-id.vo.js";
import type {
  FriendReadModel,
  FriendRelationReadModel,
  FriendRequestReadModel,
} from "../read-models/friend.read-model.js";

// after 관계는 주인과 상관없이 id로 찾는다(출시 커서). 없으면 빈 쪽이다. 커서는 관계 id다
export abstract class FriendReaderPort {
  // 맞팔 친구를 sortOrder·id 오름차순으로 준다. tagSearch는 상대 태그 부분 일치(대소문자 무시)다
  abstract listFriends(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly tagSearch: string | null;
    readonly size: number;
  }): Promise<CursorPage<FriendReadModel, string>>;
  // 상태와 상관없이 그 관계의 상대(following)를 준다
  abstract findFriendById(friendshipId: FriendshipId): Promise<FriendReadModel | null>;
  // 대기 요청을 보낸 시각·id 내림차순으로 준다
  abstract listReceivedRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly size: number;
  }): Promise<CursorPage<FriendRequestReadModel, string>>;
  abstract listSentRequests(params: {
    readonly userId: UserId;
    readonly afterFriendshipId: FriendshipId | null;
    readonly size: number;
  }): Promise<CursorPage<FriendRequestReadModel, string>>;
  abstract countReceivedRequests(userId: UserId): Promise<number>;
  abstract countSentRequests(userId: UserId): Promise<number>;
  // userIds 순서대로 viewer와 각 사람 사이 두 방향 관계를 준다
  abstract listRelationsWith(
    viewerId: UserId,
    userIds: readonly UserId[],
  ): Promise<FriendRelationReadModel[]>;
}
