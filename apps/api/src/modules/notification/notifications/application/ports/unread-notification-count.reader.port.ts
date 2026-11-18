import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 푸시 배지에 실을 받는 사람마다의 안 읽은 수. 모든 종류를 보는 앱의 알림함 수이고 없는 사람은 결과에 없다.
// 발송 직전에 커밋한 알림까지 세야 해서 커밋 뒤에 비우는 알림함 캐시를 읽지 않는다
export abstract class UnreadNotificationCountReaderPort {
  abstract countUnreadByUsers(userIds: readonly UserId[]): Promise<ReadonlyMap<string, number>>;
}
