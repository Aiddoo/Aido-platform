import type { NotificationDeliveryPreference } from "#api/modules/notification/push/application/ports/user-notification-settings.port";

// 서울·한국어·푸시와 야간 푸시를 모두 켠 기본 수신 설정이다
export function createNotificationDeliveryPreferenceFixture(
  overrides: Partial<NotificationDeliveryPreference> = {},
): NotificationDeliveryPreference {
  return {
    pushEnabled: true,
    nightPushEnabled: true,
    timezone: "Asia/Seoul",
    locale: "ko",
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: 19,
    eveningReminderMinute: 0,
    timeFormat: "TWENTY_FOUR_HOUR",
    weatherMorningEnabled: true,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: true,
    weatherEveningHour: 17,
    weatherEveningMinute: 30,
    ...overrides,
  };
}
