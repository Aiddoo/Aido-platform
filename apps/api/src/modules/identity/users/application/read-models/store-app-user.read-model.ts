import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 스토어 이벤트의 앱 사용자 ID로 찾은 사용자. 운영 알림에 싣는 값만 읽는다 */
export interface StoreAppUserReadModel {
  readonly id: UserId;
  readonly email: string;
  /** 프로필이 없으면 null이다 */
  readonly name: string | null;
}
