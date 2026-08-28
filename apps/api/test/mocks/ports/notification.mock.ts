import type { ActivePushTokenReaderPort } from "@/notification/application/ports/active-push-token.reader.port";
import type { MarketingPushOptOutTokenPort } from "@/notification/application/ports/marketing-push-opt-out-token.port";
import type { NotificationHistoryReaderPort } from "@/notification/application/ports/notification-history.reader.port";
import type { NotificationInboxReaderPort } from "@/notification/application/ports/notification-inbox.reader.port";
import type { NotificationRepositoryPort } from "@/notification/application/ports/notification.repository.port";
import type { PushReceiptRepositoryPort } from "@/notification/application/ports/push-receipt.repository.port";
import type { PushTokenRepositoryPort } from "@/notification/application/ports/push-token.repository.port";
import type { UserNotificationSettingsPort } from "@/notification/application/ports/user-notification-settings.port";

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
		createNotification: jest.fn(),
		createManyNotificationsAndReturn: jest.fn(),
		markAsRead: jest.fn(),
		markAsOpened: jest.fn(),
		markAllAsRead: jest.fn(),
		deleteNotificationsByActorId: jest.fn(),
	};
}

export function createNotificationInboxReaderMock(): NotificationInboxReaderPort {
	return {
		findNotificationById: jest.fn(),
		findNotificationsByUser: jest.fn(),
		countUnread: jest.fn(),
	};
}

export function createNotificationHistoryReaderMock(): NotificationHistoryReaderPort {
	return {
		existsRecentNotification: jest.fn(),
		findAlreadyNotifiedUserIds: jest.fn(),
		hasMilestoneNotification: jest.fn(),
	};
}

export function createPushTokenRepositoryMock(): PushTokenRepositoryPort {
	return {
		registerPushToken: jest.fn(),
		findPushTokensByUser: jest.fn(),
		findActivePushTokensByUsers: jest.fn(),
		deletePushToken: jest.fn(),
		deleteAllPushTokensByUser: jest.fn(),
		deactivateInvalidTokens: jest.fn(),
	};
}

export function createActivePushTokenReaderMock(): ActivePushTokenReaderPort {
	return {
		findByUserId: jest.fn(),
		findByUserIds: jest.fn(),
	};
}

export function createNotificationRecipientPreferenceReaderMock(): NotificationRecipientPreferenceReaderPort {
	return { getPreference: jest.fn() };
}

export function createNotificationRecipientLocaleReaderMock(): NotificationRecipientLocaleReaderPort {
	return { getLocale: jest.fn() };
}

export function createPushReceiptRepositoryMock(): PushReceiptRepositoryPort {
	return {
		findPendingPushReceipts: jest.fn(),
		recordPushReceipts: jest.fn(),
	};
}

/** MarketingPushOptOutTokenPort mock 팩토리. */
export function createMarketingPushOptOutTokenMock(): MarketingPushOptOutTokenPort {
	return {
		issue: jest.fn(),
		verify: jest.fn(),
	};
}

/** UserNotificationSettingsPort mock 팩토리. */
export function createUserNotificationSettingsMock(): UserNotificationSettingsPort {
	return {
		upsertPushTimezone: jest.fn(),
		upsertPushLocale: jest.fn(),
		getPreferenceRecord: jest.fn(),
		getPreferenceRecordsByUserIds: jest.fn(),
		getConsentRecord: jest.fn(),
		getConsentRecordsByUserIds: jest.fn(),
		updateMarketingPushConsent: jest.fn(),
	};
}
import type { NotificationRecipientLocaleReaderPort } from "@/notification/application/ports/notification-recipient-locale.reader.port";
import type { NotificationRecipientPreferenceReaderPort } from "@/notification/application/ports/notification-recipient-preference.reader.port";
