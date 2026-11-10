import {
  type SubscriptionUser,
  SubscriptionUserReaderPort,
} from "#api/modules/billing/subscriptions/application/ports/subscription-user.reader.port";

export interface InMemorySubscriptionUser extends SubscriptionUser {
  /** 처음 User.id가 아닌 RevenueCat 별칭 */
  readonly appUserAlias?: string;
}

export class InMemorySubscriptionUserReader extends SubscriptionUserReaderPort {
  readonly #users: readonly InMemorySubscriptionUser[];

  constructor(users: readonly InMemorySubscriptionUser[] = []) {
    super();
    this.#users = users;
  }

  async findByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
    const found = this.#users.find(
      (user) => user.id === appUserId || user.appUserAlias === appUserId,
    );
    return found == null ? null : { id: found.id, email: found.email, profile: found.profile };
  }
}
