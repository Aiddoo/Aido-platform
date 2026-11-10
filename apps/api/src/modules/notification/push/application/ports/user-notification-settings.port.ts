import type { TIME_FORMATS } from "@aido/api/vocabulary";

export interface NotificationDeliveryPreference {
  readonly pushEnabled: boolean;
  readonly nightPushEnabled: boolean;
  readonly timezone: string;
  readonly locale: string;
  readonly morningReminderHour: number;
  readonly morningReminderMinute: number;
  readonly eveningReminderHour: number;
  readonly eveningReminderMinute: number;
  readonly timeFormat: (typeof TIME_FORMATS)[number];
  readonly weatherMorningEnabled: boolean;
  readonly weatherMorningHour: number;
  readonly weatherMorningMinute: number;
  readonly weatherEveningEnabled: boolean;
  readonly weatherEveningHour: number;
  readonly weatherEveningMinute: number;
}

export interface NotificationMarketingConsent {
  readonly marketingPushAgreedAt: Temporal.Instant | null;
}

type NotificationDeliveryPreferenceWithUserId = NotificationDeliveryPreference & {
  readonly userId: string;
};

type NotificationMarketingConsentWithUserId = NotificationMarketingConsent & {
  readonly userId: string;
};

// 푸시 발송 판단에 필요한 사용자 설정만 알림이 소유한 모양으로 읽고 쓴다(identity 내부 레코드 변화가 넘어오지 않게)
export abstract class UserNotificationSettingsPort {
  abstract upsertPushTimezone(userId: string, timezone: string): Promise<void>;
  abstract upsertPushLocale(userId: string, locale: string): Promise<void>;
  abstract getPreferenceRecord(userId: string): Promise<NotificationDeliveryPreference | null>;
  abstract getPreferenceRecordsByUserIds(
    userIds: string[],
  ): Promise<NotificationDeliveryPreferenceWithUserId[]>;
  abstract getConsentRecord(userId: string): Promise<NotificationMarketingConsent | null>;
  abstract getConsentRecordsByUserIds(
    userIds: string[],
  ): Promise<NotificationMarketingConsentWithUserId[]>;
  abstract updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void>;
}
