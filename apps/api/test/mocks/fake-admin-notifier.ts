import type {
	AdminNotification,
	AdminNotifier,
	AdminNotifyResult,
} from "@/modules/admin-notification/providers/admin-notifier.interface";

/**
 * 테스트용 FakeAdminNotifier
 *
 * 실제 Discord 웹훅을 호출하지 않고, 발송된 알림을 메모리에 저장합니다.
 */
export class FakeAdminNotifier implements AdminNotifier {
	readonly name = "fake";
	private _sentNotifications: AdminNotification[] = [];

	isConfigured(): boolean {
		return false;
	}

	async send(notification: AdminNotification): Promise<AdminNotifyResult> {
		this._sentNotifications.push(notification);
		return { success: true };
	}

	getSentNotifications(): AdminNotification[] {
		return [...this._sentNotifications];
	}

	getLastNotification(): AdminNotification | undefined {
		return this._sentNotifications[this._sentNotifications.length - 1];
	}

	getSentCount(): number {
		return this._sentNotifications.length;
	}

	clear(): void {
		this._sentNotifications = [];
	}
}
