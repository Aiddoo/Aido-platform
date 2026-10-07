import { vi } from "vitest";

import type { ActivePushTokenReaderPort } from "#api/notification/application/ports/active-push-token.reader.port";
import type { MarketingPushOptOutTokenPort } from "#api/notification/application/ports/marketing-push-opt-out-token.port";
import type { NotificationHistoryReaderPort } from "#api/notification/application/ports/notification-history.reader.port";
import type { NotificationInboxReaderPort } from "#api/notification/application/ports/notification-inbox.reader.port";
import type { NotificationRepositoryPort } from "#api/notification/application/ports/notification.repository.port";
import type { PushReceiptRepositoryPort } from "#api/notification/application/ports/push-receipt.repository.port";
import type { PushTokenRepositoryPort } from "#api/notification/application/ports/push-token.repository.port";
import type { UserNotificationSettingsPort } from "#api/notification/application/ports/user-notification-settings.port";

/**
 * Notification application 포트 mock 팩토리 모음.
 *
 * @suites/unit은 Symbol 토큰 포트를 명시적 `.impl()`로 주입한다. 각 팩토리는
 * 포트 인터페이스를 반환하므로 포트 확장 시 누락을 타입 에러로 잡는다. 개별
 * 메서드 mock API는 spec에서 `unitRef.get<Port>(TOKEN)` 후 직접 접근한다.
 */

/** NotificationRepositoryPort mock 팩토리. */
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
    registerPushToken: vi.fn(),
    findPushTokensByUser: vi.fn(),
    findActivePushTokensByUsers: vi.fn(),
    deletePushToken: vi.fn(),
    deleteAllPushTokensByUser: vi.fn(),
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

export function createPushReceiptRepositoryMock(): PushReceiptRepositoryPort {
  return {
    findPendingPushReceipts: vi.fn(),
    recordPushReceipts: vi.fn(),
  };
}

/** MarketingPushOptOutTokenPort mock 팩토리. */
export function createMarketingPushOptOutTokenMock(): MarketingPushOptOutTokenPort {
  return {
    issue: vi.fn(),
    verify: vi.fn(),
  };
}

/** UserNotificationSettingsPort mock 팩토리. */
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
import type { NotificationRecipientLocaleReaderPort } from "#api/notification/application/ports/notification-recipient-locale.reader.port";
import type { NotificationRecipientPreferenceReaderPort } from "#api/notification/application/ports/notification-recipient-preference.reader.port";
