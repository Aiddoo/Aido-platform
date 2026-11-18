import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 푸시 배지에 실을 받는 사람마다의 안 읽은 수. 모든 종류를 보는 앱의 알림함 수이고 없는 사람은 결과에 없다
export abstract class UnreadNotificationCountReaderPort {
  abstract countByUsers(userIds: readonly UserId[]): Promise<ReadonlyMap<string, number>>;
}
