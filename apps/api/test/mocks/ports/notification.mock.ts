import { vi } from "vitest";

import type { NotificationHistoryReaderPort } from "#api/modules/notification/inbox/application/ports/notification-history.reader.port";
import type { NotificationInboxReaderPort } from "#api/modules/notification/inbox/application/ports/notification-inbox.reader.port";
import type { NotificationRepositoryPort } from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import type { ActivePushTokenReaderPort } from "#api/modules/notification/push/application/ports/active-push-token.reader.port";
import type { MarketingPushOptOutTokenPort } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";
import type { PushTokenRepositoryPort } from "#api/modules/notification/push/application/ports/push-token.repository.port";
import type { UserNotificationSettingsPort } from "#api/modules/notification/push/application/ports/user-notification-settings.port";

/**
 * Notification application 포트 mock 팩토리 모음.
 *
 * @suites/unit은 Symbol 토큰 포트를 명시적 `.impl()`로 주입한다. 각 팩토리는
 * 포트 인터페이스를 반환하므로 포트 확장 시 누락을 타입 에러로 잡는다. 개별
 * 메서드 mock API는 spec에서 `unitRef.get<Port>(TOKEN)` 후 직접 접근한다.
 */

export function createNotificationRepositoryMock(): NotificationRepositoryPort {
  return {
    createNotification: vi.fn(),
    createManyNotificationsAndReturn: vi.fn(),
    markAsRead: vi.fn(),
    markAsOpened: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotificationsByActorId: vi.fn(),
  };
}

export function createNotificationInboxReaderMock(): NotificationInboxReaderPort {
  return {
    findNotificationById: vi.fn(),
    findNotificationsByUser: vi.fn(),
    countUnread: vi.fn(),
  };
}

export function createNotificationHistoryReaderMock(): NotificationHistoryReaderPort {
  return {
    existsRecentNotification: vi.fn(),
    findAlreadyNotifiedUserIds: vi.fn(),
    hasMilestoneNotification: vi.fn(),
  };
}

export function createPushTokenRepositoryMock(): PushTokenRepositoryPort {
  return {
    releasePushTokenHeldElsewhere: vi.fn().mockResolvedValue({ userIds: [] }),
    registerPushToken: vi.fn(),
    findPushTokensByUser: vi.fn(),
    findActivePushTokensByUsers: vi.fn(),
    deletePushTokensByDevice: vi.fn().mockResolvedValue({ count: 0 }),
    deleteAllPushTokensByUser: vi.fn(),
    deletePushTokensBySessions: vi.fn().mockResolvedValue({ userIds: [] }),
    deactivateInvalidTokens: vi.fn(),
  };
}

export function createActivePushTokenReaderMock(): ActivePushTokenReaderPort {
  return {
    findByUserId: vi.fn(),
    findByUserIds: vi.fn(),
  };
}

export function createNotificationRecipientPreferenceReaderMock(): NotificationRecipientPreferenceReaderPort {
  return { getPreference: vi.fn() };
}

export function createNotificationRecipientLocaleReaderMock(): NotificationRecipientLocaleReaderPort {
  return { getLocale: vi.fn(), getLocales: vi.fn() };
}

export function createMarketingPushOptOutTokenMock(): MarketingPushOptOutTokenPort {
  return {
    issue: vi.fn(),
    verify: vi.fn(),
  };
}

export function createUserNotificationSettingsMock(): UserNotificationSettingsPort {
  return {
    upsertPushTimezone: vi.fn(),
    upsertPushLocale: vi.fn(),
    getPreferenceRecord: vi.fn(),
    getPreferenceRecordsByUserIds: vi.fn(),
    getConsentRecord: vi.fn(),
    getConsentRecordsByUserIds: vi.fn(),
    updateMarketingPushConsent: vi.fn(),
  };
}
import type { NotificationRecipientLocaleReaderPort } from "#api/modules/notification/push/application/ports/notification-recipient-locale.reader.port";
import type { NotificationRecipientPreferenceReaderPort } from "#api/modules/notification/push/application/ports/notification-recipient-preference.reader.port";
