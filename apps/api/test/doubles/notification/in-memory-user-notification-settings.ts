import {
  type NotificationDeliveryPreference,
  type NotificationMarketingConsent,
  UserNotificationSettingsPort,
} from "#api/modules/notification/push/application/ports/user-notification-settings.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createNotificationDeliveryPreferenceFixture } from "#test/fixtures/notification/notification-delivery-preference.fixture";

// 사용자별 수신 설정·광고 동의를 메모리에 둔다. 동의 조회 순서를 보려고 읽은 사용자도 남긴다
export class InMemoryUserNotificationSettings extends UserNotificationSettingsPort {
  readonly preferences = new Map<string, NotificationDeliveryPreference>();
  readonly consents = new Map<string, NotificationMarketingConsent>();
  readonly consentReadUserIds: string[] = [];
  readonly preferenceBatchReads: string[][] = [];
  readonly consentBatchReads: string[][] = [];
  readonly #now: () => Temporal.Instant;

  constructor(
    now: () => Temporal.Instant = () => Temporal.Instant.fromEpochMilliseconds(Date.now()),
  ) {
    super();
    this.#now = now;
  }

  async upsertPushTimezone(user: UserId, timezone: string): Promise<void> {
    const userId = user.value;
    this.preferences.set(userId, { ...this.#preferenceOf(userId), timezone });
  }

  async upsertPushLocale(user: UserId, locale: string): Promise<void> {
    const userId = user.value;
    this.preferences.set(userId, { ...this.#preferenceOf(userId), locale });
  }

  async getPreferenceRecord(user: UserId): Promise<NotificationDeliveryPreference | null> {
    const userId = user.value;
    return this.preferences.get(userId) ?? null;
  }

  async getPreferenceRecordsByUserIds(
    users: readonly UserId[],
  ): Promise<Array<NotificationDeliveryPreference & { readonly userId: string }>> {
    const userIds = users.map((user) => user.value);
    this.preferenceBatchReads.push([...userIds]);
    return userIds.flatMap((userId) => {
      const preference = this.preferences.get(userId);
      return preference == null ? [] : [{ userId, ...preference }];
    });
  }

  async getConsentRecord(user: UserId): Promise<NotificationMarketingConsent | null> {
    const userId = user.value;
    this.consentReadUserIds.push(userId);
    return this.consents.get(userId) ?? null;
  }

  async getConsentRecordsByUserIds(
    users: readonly UserId[],
  ): Promise<Array<NotificationMarketingConsent & { readonly userId: string }>> {
    const userIds = users.map((user) => user.value);
    this.consentBatchReads.push([...userIds]);
    return userIds.flatMap((userId) => {
      const consent = this.consents.get(userId);
      return consent == null ? [] : [{ userId, ...consent }];
    });
  }

  async updateMarketingPushConsent(user: UserId, agreed: boolean): Promise<void> {
    const userId = user.value;
    this.consents.set(userId, { marketingPushAgreedAt: agreed ? this.#now() : null });
  }

  // 설정 행이 없으면 기본 설정 행을 새로 만든다
  #preferenceOf(userId: string): NotificationDeliveryPreference {
    return this.preferences.get(userId) ?? createNotificationDeliveryPreferenceFixture();
  }
}
