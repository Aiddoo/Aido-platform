/**
 * CheerListener 단위 테스트 (Suites + GWT 패턴)
 *
 * 응원 이벤트 수신 후 알림 생성 + dedup 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationService } from "../notification.service";
import { CheerListener } from "./cheer.listener";

describe("CheerListener", () => {
	let listener: CheerListener;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CheerListener).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	describe("handleCheerSent", () => {
		const payload = {
			cheerId: 1,
			senderId: "sender-1",
			receiverId: "receiver-1",
			senderName: "홍길동",
			message: "화이팅!",
		};

		it("CHEER_RECEIVED 알림을 createAndSendWithDedup으로 생성한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue({} as never);

			// When
			await listener.handleCheerSent(payload);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "receiver-1",
					type: "CHEER_RECEIVED",
					cheerId: 1,
					friendId: "sender-1",
					metadata: { message: "화이팅!" },
				}),
			);
		});

		it("메시지가 없으면 metadata를 포함하지 않는다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue({} as never);
			const payloadNoMsg = { ...payload, message: undefined };

			// When
			await listener.handleCheerSent(payloadNoMsg);

			// Then
			expect(notificationService.createAndSendWithDedup).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: undefined,
				}),
			);
		});

		it("dedup에 의해 스킵되어도 에러가 발생하지 않는다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockResolvedValue(null);

			// When / Then
			await expect(listener.handleCheerSent(payload)).resolves.not.toThrow();
		});

		it("알림 생성 실패 시 에러를 잡아 로깅한다", async () => {
			// Given
			notificationService.createAndSendWithDedup.mockRejectedValue(
				new Error("DB error"),
			);

			// When / Then
			await expect(listener.handleCheerSent(payload)).resolves.not.toThrow();
		});
	});
});
