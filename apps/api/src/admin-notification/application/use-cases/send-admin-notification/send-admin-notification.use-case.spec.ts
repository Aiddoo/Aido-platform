/**
 * SendAdminNotificationUseCase 단위 테스트
 *
 * - 채널별 올바른 notifier 라우팅
 * - 발송 실패 시 예외(BullMQ 재시도 트리거)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { AdminNotification } from "../../../domain/value-objects/admin-notification-message.vo";
import {
	ADMIN_NOTIFIER,
	type AdminNotifier,
	PAYMENT_NOTIFIER,
} from "../../ports/admin-notifier.port";
import { SendAdminNotificationUseCase } from "./send-admin-notification.use-case";

describe("SendAdminNotificationUseCase", () => {
	let useCase: SendAdminNotificationUseCase;
	let adminNotifier: Mocked<AdminNotifier>;
	let paymentNotifier: Mocked<AdminNotifier>;

	const notification: AdminNotification = { title: "테스트", body: "내용" };

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendAdminNotificationUseCase).compile();
		useCase = unit;
		adminNotifier = unitRef.get(ADMIN_NOTIFIER);
		paymentNotifier = unitRef.get(PAYMENT_NOTIFIER);
		adminNotifier.send.mockResolvedValue({ success: true });
		paymentNotifier.send.mockResolvedValue({ success: true });
	});

	it("admin 채널 → ADMIN_NOTIFIER로 발송해야 한다", async () => {
		await useCase.execute("admin", notification);

		expect(adminNotifier.send).toHaveBeenCalledWith(notification);
		expect(paymentNotifier.send).not.toHaveBeenCalled();
	});

	it("payment 채널 → PAYMENT_NOTIFIER로 발송해야 한다", async () => {
		await useCase.execute("payment", notification);

		expect(paymentNotifier.send).toHaveBeenCalledWith(notification);
		expect(adminNotifier.send).not.toHaveBeenCalled();
	});

	it("send 실패 시 Error를 throw해야 한다 (BullMQ 재시도 트리거)", async () => {
		adminNotifier.send.mockResolvedValue({
			success: false,
			error: "Webhook 404",
		});

		await expect(useCase.execute("admin", notification)).rejects.toThrow(
			"Discord webhook failed: Webhook 404",
		);
	});
});
