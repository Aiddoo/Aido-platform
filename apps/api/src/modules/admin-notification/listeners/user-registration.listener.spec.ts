import { TestBed } from "@suites/unit";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import { ADMIN_NOTIFIER } from "../providers/admin-notifier.interface";
import { UserRegistrationListener } from "./user-registration.listener";

describe("UserRegistrationListener", () => {
	let listener: UserRegistrationListener;
	let notifier: { send: jest.Mock };

	beforeEach(async () => {
		const mockNotifier = {
			name: "fake",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};

		const { unit } = await TestBed.solitary(UserRegistrationListener)
			.mock(ADMIN_NOTIFIER)
			.impl(() => mockNotifier)
			.compile();

		listener = unit;
		notifier = mockNotifier;
	});

	const basePayload: UserRegisteredEventPayload = {
		userId: "user-123",
		email: "test@example.com",
		provider: "credential",
		registeredAt: "2026-02-09T00:00:00.000Z",
	};

	it("회원가입 이벤트를 받으면 알림을 발송한다", async () => {
		// When
		await listener.handleUserRegistered(basePayload);

		// Then
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "새로운 회원가입",
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "이메일",
						value: "test@example.com",
					}),
				]),
			}),
		);
	});

	it("소셜 로그인 provider를 한국어 라벨로 변환한다", async () => {
		// Given
		const payload = { ...basePayload, provider: "google" as const };

		// When
		await listener.handleUserRegistered(payload);

		// Then
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: expect.arrayContaining([
					expect.objectContaining({ name: "가입 방식", value: "Google" }),
				]),
			}),
		);
	});

	it("알림 발송 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		notifier.send.mockResolvedValue({
			success: false,
			error: "Webhook failed",
		});

		// When & Then
		await expect(
			listener.handleUserRegistered(basePayload),
		).resolves.not.toThrow();
	});

	it("알림 발송 중 예외가 발생해도 전파되지 않는다", async () => {
		// Given
		notifier.send.mockRejectedValue(new Error("Network error"));

		// When & Then
		await expect(
			listener.handleUserRegistered(basePayload),
		).resolves.not.toThrow();
	});
});
