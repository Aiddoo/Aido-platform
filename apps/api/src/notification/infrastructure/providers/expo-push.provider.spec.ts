/**
 * ExpoPushProvider 단위 테스트 (Suites + GWT 패턴)
 *
 * Expo Push Notifications를 통한 푸시 알림 발송 검증
 * - 토큰 유효성 검증 (Expo 정적 메서드)
 * - 단일 발송 (send): 성공/실패 티켓 처리, BusinessException 전파
 * - 배치 발송 (sendBatch): 청크 처리, 부분 실패, 유효하지 않은 토큰 필터링
 */

import { TestBed } from "@suites/unit";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type { PushPayload } from "../../application/ports/push-provider.port";
import { EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH } from "./expo-push-message";
import { ExpoPushProvider } from "./expo-push.provider";

// expo-server-sdk 모듈 mock — #expo 필드에 직접 접근 불가하므로 모듈 레벨 mock 사용
const mockSendPushNotificationsAsync = jest.fn();
const mockChunkPushNotifications = jest.fn();
const mockExpoConstructor = jest.fn();

jest.mock("expo-server-sdk", () => {
	// v6부터 ESM-only라 jest 29(CJS)에서 requireActual 불가 —
	// isExpoPushToken은 실제 구현과 동일한 판정식으로 직접 제공
	const isExpoPushToken = (token: unknown): boolean =>
		typeof token === "string" &&
		(((token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) &&
			token.endsWith("]")) ||
			/^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i.test(token));

	return {
		__esModule: true,
		default: class MockExpo {
			constructor(options?: unknown) {
				mockExpoConstructor(options);
			}

			sendPushNotificationsAsync = mockSendPushNotificationsAsync;
			chunkPushNotifications = mockChunkPushNotifications;
			static isExpoPushToken = isExpoPushToken;
		},
	};
});

describe("ExpoPushProvider — Expo 푸시 프로바이더", () => {
	let provider: ExpoPushProvider;

	const validToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
	const invalidToken = "invalid-token";

	const createPayload = (overrides?: Partial<PushPayload>): PushPayload => ({
		token: validToken,
		title: "테스트 알림",
		body: "알림 내용",
		...overrides,
	});

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(ExpoPushProvider)
			.mock(TypedConfigService)
			.impl(() => ({ expoAccessToken: "test-expo-access-token" }))
			.compile();
		provider = unit;
	});

	describe("name", () => {
		it('name이 "expo"여야 한다', () => {
			// When / Then
			expect(provider.name).toBe("expo");
		});

		it("설정된 Expo access token을 SDK 생성자에 전달한다", () => {
			expect(mockExpoConstructor).toHaveBeenCalledWith({
				accessToken: "test-expo-access-token",
			});
		});
	});

	describe("validateToken", () => {
		it.each([
			validToken,
			"ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
			"12345678-1234-1234-1234-123456789012",
		])("유효한 Expo 토큰 %s은 true를 반환해야 한다", (token) => {
			expect(provider.validateToken(token)).toBe(true);
		});

		it("유효하지 않은 토큰은 false를 반환해야 한다", () => {
			// Given
			const token = invalidToken;

			// When
			const result = provider.validateToken(token);

			// Then
			expect(result).toBe(false);
		});
	});

	describe("send", () => {
		it("유효한 토큰으로 성공적으로 발송해야 한다", async () => {
			// Given
			const payload = createPayload();
			mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-123" }]);

			// When
			const result = await provider.send(payload);

			// Then
			expect(result).toEqual({
				token: validToken,
				success: true,
				ticketId: "ticket-123",
			});
			expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith([
				expect.objectContaining({
					to: validToken,
					title: "테스트 알림",
					body: "알림 내용",
					sound: "default",
					channelId: "default",
					priority: "high",
				}),
			]);
		});

		it("유효하지 않은 토큰은 invalidPushToken 에러를 던져야 한다", async () => {
			// Given
			const payload = createPayload({ token: invalidToken });

			// When / Then
			await expect(provider.send(payload)).rejects.toThrow(ApplicationException);
			expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
		});

		it("티켓이 없으면 pushSendFailed 에러를 던져야 한다", async () => {
			// Given
			const payload = createPayload();
			mockSendPushNotificationsAsync.mockResolvedValue([]);

			// When / Then
			await expect(provider.send(payload)).rejects.toThrow(ApplicationException);
		});

		it("Expo SDK 에러 시 pushSendFailed 에러를 던져야 한다", async () => {
			// Given
			const payload = createPayload();
			mockSendPushNotificationsAsync.mockRejectedValue(new Error("Network error"));

			// When / Then
			await expect(provider.send(payload)).rejects.toThrow(ApplicationException);
		});

		it("에러 티켓을 올바르게 파싱해야 한다", async () => {
			// Given
			const payload = createPayload();
			mockSendPushNotificationsAsync.mockResolvedValue([
				{
					status: "error",
					message: "DeviceNotRegistered",
					details: { error: "DeviceNotRegistered" },
				},
			]);

			// When
			const result = await provider.send(payload);

			// Then
			expect(result).toEqual({
				token: validToken,
				success: false,
				error: "DeviceNotRegistered",
				errorCode: "DeviceNotRegistered",
			});
		});

		it("BusinessException은 그대로 재전파해야 한다", async () => {
			// Given
			const payload = createPayload();
			// 첫 번째 호출은 빈 티켓 반환 -> pushSendFailed BusinessException 발생
			mockSendPushNotificationsAsync.mockResolvedValue([undefined]);

			// When / Then
			await expect(provider.send(payload)).rejects.toThrow(ApplicationException);
		});

		it("payload의 선택적 필드가 메시지에 반영되어야 한다", async () => {
			// Given
			const payload = createPayload({
				data: { type: "DAILY_COMPLETE", screen: "home" },
				badge: 5,
				sound: "default",
				channelId: "reminder",
				priority: "normal",
				ttl: 3600,
			});
			mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-456" }]);

			// When
			await provider.send(payload);

			// Then
			expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith([
				expect.objectContaining({
					to: validToken,
					title: "테스트 알림",
					body: "알림 내용",
					data: { type: "DAILY_COMPLETE", screen: "home" },
					badge: 5,
					sound: "default",
					channelId: "reminder",
					priority: "normal",
					ttl: 3600,
				}),
			]);
		});

		it("Expo 한도를 넘는 payload는 SDK로 보내지 않고 MessageTooBig을 반환한다", async () => {
			// Given
			const payload = createPayload({ body: "🐾".repeat(EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) });

			// When
			const result = await provider.send(payload);

			// Then
			expect(result).toMatchObject({
				token: validToken,
				success: false,
				errorCode: "MessageTooBig",
			});
			expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
		});
	});

	describe("sendBatch", () => {
		it("여러 알림을 성공적으로 발송해야 한다", async () => {
			// Given
			const payloads = [
				createPayload({ token: validToken, title: "알림 1" }),
				createPayload({ token: validToken, title: "알림 2" }),
			];
			const messages = payloads.map((p) => expect.objectContaining({ to: p.token }));
			mockChunkPushNotifications.mockReturnValue([messages]);
			mockSendPushNotificationsAsync.mockResolvedValue([
				{ status: "ok", id: "ticket-1" },
				{ status: "ok", id: "ticket-2" },
			]);

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(2);
			expect(result.successCount).toBe(2);
			expect(result.failureCount).toBe(0);
			expect(result.invalidTokens).toEqual([]);
			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				token: validToken,
				success: true,
				ticketId: "ticket-1",
			});
			expect(result.results[1]).toEqual({
				token: validToken,
				success: true,
				ticketId: "ticket-2",
			});
		});

		it("유효하지 않은 토큰을 필터링해야 한다", async () => {
			// Given
			const payloads = [
				createPayload({ token: validToken, title: "유효" }),
				createPayload({ token: invalidToken, title: "무효" }),
			];
			// chunkPushNotifications는 유효한 메시지만 받음
			mockChunkPushNotifications.mockReturnValue([[expect.objectContaining({ to: validToken })]]);
			mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-1" }]);

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(2);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.invalidTokens).toContain(invalidToken);
			// 무효 토큰에 대한 결과
			const invalidResult = result.results.find((r) => r.errorCode === "NOTIFICATION_1001");
			expect(invalidResult).toBeDefined();
			expect(invalidResult?.success).toBe(false);
		});

		it("모든 토큰이 유효하지 않으면 전체 실패를 반환해야 한다", async () => {
			// Given
			const payloads = [
				createPayload({ token: invalidToken }),
				createPayload({ token: "also-invalid" }),
			];

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(2);
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(2);
			expect(result.invalidTokens).toEqual([invalidToken, "also-invalid"]);
			expect(mockChunkPushNotifications).not.toHaveBeenCalled();
			expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
		});

		it("부분 실패를 올바르게 처리해야 한다", async () => {
			// Given
			const token2 = "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]";
			const payloads = [
				createPayload({ token: validToken, title: "성공" }),
				createPayload({ token: token2, title: "실패" }),
			];
			mockChunkPushNotifications.mockReturnValue([
				[expect.objectContaining({ to: validToken }), expect.objectContaining({ to: token2 })],
			]);
			mockSendPushNotificationsAsync.mockResolvedValue([
				{ status: "ok", id: "ticket-1" },
				{
					status: "error",
					message: "DeviceNotRegistered",
					details: { error: "DeviceNotRegistered" },
				},
			]);

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(2);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.results[0]).toEqual({
				token: validToken,
				success: true,
				ticketId: "ticket-1",
			});
			expect(result.results[1]).toEqual({
				token: token2,
				success: false,
				error: "DeviceNotRegistered",
				errorCode: "DeviceNotRegistered",
			});
			// DeviceNotRegistered 에러는 invalidTokens에 추가
			expect(result.invalidTokens).toContain(token2);
		});

		it("청크 전체 실패 시 해당 청크의 모든 결과를 실패로 처리해야 한다", async () => {
			// Given
			const payloads = [
				createPayload({ token: validToken, title: "알림 1" }),
				createPayload({ token: validToken, title: "알림 2" }),
			];
			mockChunkPushNotifications.mockReturnValue([
				[expect.objectContaining({ to: validToken }), expect.objectContaining({ to: validToken })],
			]);
			mockSendPushNotificationsAsync.mockRejectedValue(new Error("Expo server error"));

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(2);
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(2);
			expect(result.results).toHaveLength(2);
			for (const r of result.results) {
				expect(r.success).toBe(false);
				expect(r.error).toBe("Expo server error");
				expect(r.errorCode).toBe("NOTIFICATION_1003");
			}
		});

		it("Expo가 일부 티켓만 반환해도 모든 입력에 순서대로 결과를 만든다", async () => {
			const secondToken = "ExponentPushToken[second-token]";
			const payloads = [createPayload(), createPayload({ token: secondToken })];
			mockChunkPushNotifications.mockImplementation((messages) => [messages]);
			mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-1" }]);

			const result = await provider.sendBatch(payloads);

			expect(result).toMatchObject({
				total: 2,
				successCount: 1,
				failureCount: 1,
			});
			expect(result.results).toEqual([
				{ token: validToken, success: true, ticketId: "ticket-1" },
				{
					token: secondToken,
					success: false,
					error: "No ticket or payload",
					errorCode: "NOTIFICATION_1003",
				},
			]);
		});

		it("빈 페이로드 배열은 전체 실패(0건)를 반환해야 한다", async () => {
			// Given
			const payloads: PushPayload[] = [];

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result.total).toBe(0);
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(0);
			expect(result.results).toEqual([]);
			expect(result.invalidTokens).toEqual([]);
		});

		it("한도를 넘는 항목만 거부하고 다른 항목은 순서대로 발송한다", async () => {
			// Given
			const sendableToken = "ExponentPushToken[sendable-token]";
			const payloads = [
				createPayload({ body: "한".repeat(EXPO_PUSH_PAYLOAD_MAX_BYTE_LENGTH) }),
				createPayload({ token: sendableToken, title: "전송 가능" }),
			];
			mockChunkPushNotifications.mockImplementation((messages) => [messages]);
			mockSendPushNotificationsAsync.mockResolvedValue([{ status: "ok", id: "ticket-sendable" }]);

			// When
			const result = await provider.sendBatch(payloads);

			// Then
			expect(result).toMatchObject({
				total: 2,
				successCount: 1,
				failureCount: 1,
				invalidTokens: [],
			});
			expect(result.results).toEqual([
				expect.objectContaining({
					token: validToken,
					success: false,
					errorCode: "MessageTooBig",
				}),
				{
					token: sendableToken,
					success: true,
					ticketId: "ticket-sendable",
				},
			]);
			expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
			expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith([
				expect.objectContaining({ to: sendableToken }),
			]);
		});
	});
});
