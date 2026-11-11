/** 스토어 이벤트의 앱 사용자 ID(User.id 또는 별칭)로 찾은 사용자. 알림에 싣는 값만 읽는다. */
export interface SubscriptionUser {
  readonly id: string;
  readonly email: string;
  readonly profile: { readonly name: string | null } | null;
}

export abstract class SubscriptionUserReaderPort {
  /** RevenueCat appUserId는 User.id이거나 별칭(revenueCatUserId)이다. 없으면 null이다. */
  abstract findByAppUserId(appUserId: string): Promise<SubscriptionUser | null>;
}
