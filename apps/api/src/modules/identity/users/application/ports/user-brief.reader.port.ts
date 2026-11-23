import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserAccountIdentityReadModel,
  UserBriefReadModel,
} from "../read-models/user-brief.read-model.js";

// 다른 Context가 사용자 테이블을 직접 읽지 않고 사람을 확인·표시하는 조회 포트다. 활성 UoW 안에서는 같은 트랜잭션으로 읽는다
export abstract class UserBriefReaderPort {
  // 탈퇴 대기 중인 사용자도 준다. 없는 id는 결과에 없다
  abstract listByUserIds(userIds: readonly UserId[]): Promise<UserBriefReadModel[]>;
  // ACTIVE이고 탈퇴 대기 중이 아닌 사용자다
  abstract existsActiveUser(userId: UserId): Promise<boolean>;
  abstract findActiveUserIdByTag(userTag: string): Promise<UserId | null>;
  abstract findAccountIdentity(userId: UserId): Promise<UserAccountIdentityReadModel | null>;
}
