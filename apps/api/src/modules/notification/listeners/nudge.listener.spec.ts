/**
 * NudgeListener 단위 테스트 (Suites + GWT 패턴)
 *
 * 콕 찌르기 이벤트 수신 후 알림 생성 + dedup 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationService } from "../notification.service";
import { NudgeListener } from "./nudge.listener";

describe("NudgeListener", () => {
	let listener: NudgeListener;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(NudgeListener).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	describe("handleNudgeSent", () => {
		const payload = {
			nudgeId: 1,
			senderId: "sender-1",
			receiverId: "receiver-1",
			senderName: "홍길동",
			todoId: 10,
		};

		it("NUDGE_RECEIVED 알림을 createAndSendWithDedup으로 생성한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue({} as never);

			// When
			await listener.handleNudgeSent(payload);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "receiver-1",
					type: "NUDGE_RECEIVED",
					nudgeId: 1,
					friendId: "sender-1",
					todoId: 10,
				}),
			);
		});

		it("dedup에 의해 스킵되어도 에러가 발생하지 않는다", async () => {
			// Given — dedup 스킵 (null 반환)
			notificationService.createAndSendWithDedup.mockResolvedValue(null);

			// When / Then — 에러 없이 완료
			await expect(listener.handleNudgeSent(payload)).resolves.not.toThrow();
		});

		it("알림 생성 실패 시 에러를 잡아 로깅한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);

			// When / Then — 에러를 throw하지 않음
			await expect(listener.handleNudgeSent(payload)).resolves.not.toThrow();
		});
	});
});
