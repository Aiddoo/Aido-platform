import type {
	AdminNotification,
	AdminNotifier,
	AdminNotifyResult,
} from "../../src/modules/admin-notification/providers/admin-notifier.interface";

interface NotificationRecord {
	notification: AdminNotification;
	sentAt: Date;
}

/**
 * 테스트용 FakeAdminNotifier
 *
 * 실제 웹훅을 호출하지 않고 발송 기록을 메모리에 저장합니다.
 *
 * @see apps/api/test/mocks/fake-email.service.ts
 */
export class FakeAdminNotifier implements AdminNotifier {
	readonly name = "fake";
	private _notifications: NotificationRecord[] = [];
	private _shouldFail = false;
	private _failureCount = 0;
	private _maxFailures = 0;
	private _configured = true;

	isConfigured(): boolean {
		return this._configured;
	}

	async send(notification: AdminNotification): Promise<AdminNotifyResult> {
		if (!this._configured) {
			return { success: false, error: "Not configured" };
		}

		if (this._shouldFail && this._failureCount < this._maxFailures) {
			this._failureCount++;
			return {
				success: false,
				error: "Simulated failure for testing",
			};
		}

		this._notifications.push({
			notification,
			sentAt: new Date(),
		});

		return { success: true };
	}

	// ===== 테스트 유틸리티 =====

	getSentCount(): number {
		return this._notifications.length;
	}

	getLastNotification(): AdminNotification | undefined {
		return this._notifications[this._notifications.length - 1]?.notification;
	}

	getAllNotifications(): NotificationRecord[] {
		return [...this._notifications];
	}

	hasNotificationWithTitle(title: string): boolean {
		return this._notifications.some((r) => r.notification.title === title);
	}

	simulateFailures(count: number): void {
		this._shouldFail = true;
		this._maxFailures = count;
		this._failureCount = 0;
	}

	setConfigured(configured: boolean): void {
		this._configured = configured;
	}

	clear(): void {
		this._notifications = [];
		this._shouldFail = false;
		this._maxFailures = 0;
		this._failureCount = 0;
		this._configured = true;
	}
}
