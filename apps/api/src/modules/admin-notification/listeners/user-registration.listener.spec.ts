import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";

import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import { ADMIN_NOTIFICATION_QUEUE } from "../processors/admin-notification.processor";
import { UserRegistrationListener } from "./user-registration.listener";

describe("UserRegistrationListener", () => {
	let listener: UserRegistrationListener;
	let mockQueue: Mocked<Queue>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UserRegistrationListener)
			.mock(getQueueToken(ADMIN_NOTIFICATION_QUEUE))
			.impl(() => ({
				add: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		listener = unit;
		mockQueue = unitRef.get(getQueueToken(ADMIN_NOTIFICATION_QUEUE));
	});

	const basePayload: UserRegisteredEventPayload = {
		userId: "user-123",
		email: "test@example.com",
		provider: "credential",
		registeredAt: "2026-02-09T00:00:00.000Z",
	};

	/** queue.add 호출의 job data에서 notification 추출 */
	function getNotification() {
		return mockQueue.add.mock.calls[0]?.[1]?.notification;
	}

	/** notification의 특정 이름 필드 반환 */
	function getField(name: string) {
		return getNotification()?.fields?.find(
			(f: { name: string }) => f.name === name,
		);
	}

	// =========================================================================
	// 기본 동작
	// =========================================================================

	it("회원가입 이벤트를 받으면 큐에 알림 잡을 등록한다", async () => {
		// When
		await listener.handleUserRegistered(basePayload);

		// Then
		expect(mockQueue.add).toHaveBeenCalledWith(
			"send-notification",
			expect.objectContaining({
				channel: "admin",
				notification: expect.objectContaining({
					title: "새로운 회원가입",
					fields: expect.arrayContaining([
						expect.objectContaining({
							name: "이메일",
							value: "test@example.com",
						}),
					]),
				}),
			}),
			expect.any(Object),
		);
	});

	it("body에 사용자 이메일이 볼드로 포함되어야 한다", async () => {
		// When
		await listener.handleUserRegistered(basePayload);

		// Then
		expect(getNotification()?.body).toContain("**test@example.com**");
	});

	it("소셜 로그인 provider를 한국어 라벨로 변환한다", async () => {
		// Given
		const payload: UserRegisteredEventPayload = {
			...basePayload,
			provider: "google",
		};

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(getNotification()?.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "가입 방식", value: "Google" }),
			]),
		);
	});

	// =========================================================================
	// 기기 추정 정보
	// =========================================================================

	it("Apple 가입 시 기기 추정 정보가 iOS로 표시되어야 한다", async () => {
		// Given
		const payload: UserRegisteredEventPayload = {
			...basePayload,
			provider: "apple",
		};

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(getField("기기 (추정)")?.value).toContain("iOS");
	});

	it("Google 가입 시 기기 추정 정보가 Android로 표시되어야 한다", async () => {
		// Given
		const payload: UserRegisteredEventPayload = {
			...basePayload,
			provider: "google",
		};

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(getField("기기 (추정)")?.value).toContain("Android");
	});

	it("이메일 가입 시 기기 추정 필드가 없어야 한다", async () => {
		// Given
		const payload: UserRegisteredEventPayload = {
			...basePayload,
			provider: "credential",
		};

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(getField("기기 (추정)")).toBeUndefined();
	});

	// =========================================================================
	// 날짜 포맷
	// =========================================================================

	it("가입 시각이 Discord timestamp 형식으로 포맷되어야 한다", async () => {
		// When
		await listener.handleUserRegistered(basePayload);

		// Then
		expect(getField("가입 시각")?.value).toMatch(/^<t:\d+:f>$/);
	});

	// =========================================================================
	// 에러 처리
	// =========================================================================

	it("큐 등록 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		mockQueue.add.mockRejectedValue(new Error("Queue error"));

		// When & Then
		await expect(
			listener.handleUserRegistered(basePayload),
		).resolves.not.toThrow();
	});
});
