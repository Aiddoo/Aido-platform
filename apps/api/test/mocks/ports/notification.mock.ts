import type { MarketingPushOptOutTokenPort } from "@/notification/application/ports/marketing-push-opt-out-token.port";
import type { NotificationRepositoryPort } from "@/notification/application/ports/notification.repository.port";
import type { PushDispatcherPort } from "@/notification/application/ports/push-dispatcher.port";
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
		createManyNotifications: jest.fn(),
		createManyNotificationsAndReturn: jest.fn(),
		findNotificationById: jest.fn(),
		findNotificationsByUser: jest.fn(),
		markAsRead: jest.fn(),
		markAsOpened: jest.fn(),
		markAllAsRead: jest.fn(),
		countUnread: jest.fn(),
		deleteOldNotifications: jest.fn(),
		deleteNotificationsByActorId: jest.fn(),
		existsRecentNotification: jest.fn(),
		findAlreadyNotifiedUserIds: jest.fn(),
		registerPushToken: jest.fn(),
		findPushTokensByUser: jest.fn(),
		findActivePushTokensByUsers: jest.fn(),
		deletePushToken: jest.fn(),
		deleteAllPushTokensByUser: jest.fn(),
		deactivateInvalidTokens: jest.fn(),
		createPushDispatch: jest.fn(),
		createPushDispatches: jest.fn(),
		markPushDispatchSkipped: jest.fn(),
		markPushDispatchesSkipped: jest.fn(),
		markPushDispatchFailed: jest.fn(),
		recordPushDeliveryResults: jest.fn(),
		recordPushDeliveryResultsBatch: jest.fn(),
		findPendingPushReceipts: jest.fn(),
		recordPushReceipts: jest.fn(),
	};
}

/** PushDispatcherPort mock 팩토리. */
export function createPushDispatcherMock(): PushDispatcherPort {
	return {
		shouldSendPush: jest.fn(),
		getUserLocale: jest.fn(),
		fireAndForgetPush: jest.fn(),
		fireAndForgetBatchPush: jest.fn(),
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
