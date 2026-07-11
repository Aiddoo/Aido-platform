/**
 * EnqueueUserRegisteredUseCase 단위 테스트
 *
 * - 회원가입 메시지를 admin 채널 SEND 잡으로 등록
 * - 큐 실패는 그대로 전파(파사드가 fire-and-forget 처리)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { UserRegisteredEventPayload } from "../../../domain/events/user-registered.payload";
import {
	ADMIN_NOTIFICATION_QUEUE_PORT,
	type AdminNotificationQueuePort,
} from "../../ports/admin-notification-queue.port";
import { EnqueueUserRegisteredUseCase } from "./enqueue-user-registered.use-case";

describe("EnqueueUserRegisteredUseCase", () => {
	let useCase: EnqueueUserRegisteredUseCase;
	let queue: Mocked<AdminNotificationQueuePort>;

	const payload: UserRegisteredEventPayload = {
		userId: "user-1",
		email: "test@example.com",
		provider: "apple",
		registeredAt: "2026-03-07T12:00:00.000Z",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			EnqueueUserRegisteredUseCase,
		).compile();
		useCase = unit;
		queue = unitRef.get(ADMIN_NOTIFICATION_QUEUE_PORT);
	});

	it("admin 채널로 회원가입 알림을 등록한다", async () => {
		await useCase.execute(payload);

		expect(queue.enqueueSend).toHaveBeenCalledWith(
			"admin",
			expect.objectContaining({
				title: "새로운 회원가입",
				body: expect.stringContaining("test@example.com"),
			}),
		);
	});

	it("기기 추정 라벨을 포함한다 (apple → iOS)", async () => {
		await useCase.execute(payload);

		const notification = queue.enqueueSend.mock.calls[0]?.[1];
		expect(notification?.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "기기 (추정)",
					value: "🍎 iOS (추정)",
				}),
			]),
		);
	});

	it("큐 등록 실패 시 에러를 전파한다", async () => {
		queue.enqueueSend.mockRejectedValue(new Error("Redis connection error"));

		await expect(useCase.execute(payload)).rejects.toThrow(
			"Redis connection error",
		);
	});
});
