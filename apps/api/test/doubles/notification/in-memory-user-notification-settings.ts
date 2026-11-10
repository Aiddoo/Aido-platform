import {
  type NotificationDeliveryPreference,
  type NotificationMarketingConsent,
  UserNotificationSettingsPort,
} from "#api/modules/notification/push/application/ports/user-notification-settings.port";
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

  async upsertPushTimezone(userId: string, timezone: string): Promise<void> {
    this.preferences.set(userId, { ...this.#preferenceOf(userId), timezone });
  }

  async upsertPushLocale(userId: string, locale: string): Promise<void> {
    this.preferences.set(userId, { ...this.#preferenceOf(userId), locale });
  }

  async getPreferenceRecord(userId: string): Promise<NotificationDeliveryPreference | null> {
    return this.preferences.get(userId) ?? null;
  }

  async getPreferenceRecordsByUserIds(
    userIds: string[],
  ): Promise<Array<NotificationDeliveryPreference & { readonly userId: string }>> {
    this.preferenceBatchReads.push([...userIds]);
    return userIds.flatMap((userId) => {
      const preference = this.preferences.get(userId);
      return preference == null ? [] : [{ userId, ...preference }];
    });
  }

  async getConsentRecord(userId: string): Promise<NotificationMarketingConsent | null> {
    this.consentReadUserIds.push(userId);
    return this.consents.get(userId) ?? null;
  }

  async getConsentRecordsByUserIds(
    userIds: string[],
  ): Promise<Array<NotificationMarketingConsent & { readonly userId: string }>> {
    this.consentBatchReads.push([...userIds]);
    return userIds.flatMap((userId) => {
      const consent = this.consents.get(userId);
      return consent == null ? [] : [{ userId, ...consent }];
    });
  }

  async updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void> {
    this.consents.set(userId, { marketingPushAgreedAt: agreed ? this.#now() : null });
  }

  // 설정 행이 없으면 기본 설정 행을 새로 만든다
  #preferenceOf(userId: string): NotificationDeliveryPreference {
    return this.preferences.get(userId) ?? createNotificationDeliveryPreferenceFixture();
  }
}
