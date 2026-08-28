import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import {
	createActivePushTokenReaderMock,
	createPushTokenRepositoryMock,
} from "@test/mocks/ports/notification.mock";

import type { PushTokenRecord } from "../../domain/records/notification.record";
import {
	ACTIVE_PUSH_TOKEN_READER,
	type ActivePushTokenReaderPort,
} from "../ports/active-push-token.reader.port";
import { NOTIFICATION_CACHE, type NotificationCachePort } from "../ports/notification-cache.port";
import {
	PUSH_PROVIDER,
	type PushProvider,
	RetryablePushProviderTransportError,
} from "../ports/push-provider.port";
import {
	PUSH_TOKEN_REPOSITORY,
	type PushTokenRepositoryPort,
} from "../ports/push-token.repository.port";
import { PushNotificationDeliveryService } from "./push-notification-delivery.service";
import type { BatchPushNotificationPayload } from "./push-notification-payload.factory";

const TOKEN_DATE = new Date("2026-07-01T00:00:00.000Z");

function pushToken(input: {
	userId: string;
	token: string;
	payloadVersion: number;
	appVersion: string | null;
}): PushTokenRecord {
	return {
		id: 1,
		userId: input.userId,
		token: input.token,
		deviceId: `device-${input.token}`,
		platform: "IOS",
		isActive: true,
		createdAt: TOKEN_DATE,
		updatedAt: TOKEN_DATE,
		lastUsedAt: TOKEN_DATE,
		payloadVersion: input.payloadVersion,
		appVersion: input.appVersion,
	};
}

function batchPayload(input: {
	userId: string;
	dispatchId: number;
	requiresFeatureCapability?: boolean;
}): BatchPushNotificationPayload {
	return {
		userId: input.userId,
		dispatchId: input.dispatchId,
		requiresFeatureCapability: input.requiresFeatureCapability ?? false,
		title: `title-${input.dispatchId}`,
		body: `body-${input.dispatchId}`,
		data: { dispatchId: input.dispatchId },
	};
}

describe("PushNotificationDeliveryService", () => {
	let service: PushNotificationDeliveryService;
	let activeTokenReader: Mocked<ActivePushTokenReaderPort>;
	let tokenRepository: Mocked<PushTokenRepositoryPort>;
	let pushProvider: Mocked<PushProvider>;
	let notificationCache: Mocked<NotificationCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(PushNotificationDeliveryService)
			.mock<ActivePushTokenReaderPort>(ACTIVE_PUSH_TOKEN_READER)
			.impl(() => createActivePushTokenReaderMock())
			.mock<PushTokenRepositoryPort>(PUSH_TOKEN_REPOSITORY)
			.impl(() => createPushTokenRepositoryMock())
			.mock<NotificationCachePort>(NOTIFICATION_CACHE)
			.impl(() => createNotificationCacheMock())
			.compile();
		service = unit;
		activeTokenReader = unitRef.get(ACTIVE_PUSH_TOKEN_READER);
		tokenRepository = unitRef.get(PUSH_TOKEN_REPOSITORY);
		pushProvider = unitRef.get(PUSH_PROVIDER);
		notificationCache = unitRef.get(NOTIFICATION_CACHE);
		activeTokenReader.findByUserId.mockResolvedValue([]);
		activeTokenReader.findByUserIds.mockResolvedValue(new Map());
		notificationCache.invalidatePushTokens.mockResolvedValue(undefined);
	});

	it("일반 단건은 cache-aside reader의 활성 토큰이 없으면 provider를 호출하지 않는다", async () => {
		const result = await service.deliverSingle({
			data: { userId: "user-1", type: "FOLLOW_NEW", title: "title", body: "body" },
			payload: { title: "title", body: "body" },
		});

		expect(result).toEqual({ status: "skipped", reason: "NO_ACTIVE_TOKEN" });
		expect(activeTokenReader.findByUserId).toHaveBeenCalledWith("user-1");
		expect(pushProvider.sendBatch).not.toHaveBeenCalled();
	});

	it("feature-discovery 단건은 활성 토큰과 지원 capability 부재를 구분한다", async () => {
		tokenRepository.findPushTokensByUser.mockResolvedValue([
			pushToken({
				userId: "user-1",
				token: "legacy-token",
				payloadVersion: 1,
				appVersion: "1.9.0",
			}),
		]);

		await expect(
			service.deliverSingle({
				data: {
					userId: "user-1",
					type: "SYSTEM_NOTICE",
					title: "title",
					body: "body",
					campaignKey: "feature-discovery-2026-08",
				},
				payload: { title: "title", body: "body" },
			}),
		).resolves.toEqual({ status: "skipped", reason: "UNSUPPORTED_APP_CAPABILITY" });
		expect(activeTokenReader.findByUserId).not.toHaveBeenCalled();
	});

	it("단건 provider가 invalid token을 반환하면 저장소 비활성화와 해당 사용자 캐시 무효화를 완료한다", async () => {
		activeTokenReader.findByUserId.mockResolvedValue(["invalid-token"]);
		pushProvider.sendBatch.mockResolvedValue({
			total: 1,
			successCount: 0,
			failureCount: 1,
			results: [{ token: "invalid-token", success: false, errorCode: "DeviceNotRegistered" }],
			invalidTokens: ["invalid-token"],
		});

		await expect(
			service.deliverSingle({
				data: { userId: "user-1", type: "FOLLOW_NEW", title: "title", body: "body" },
				payload: { title: "title", body: "body", categoryId: "TEST" },
			}),
		).resolves.toMatchObject({
			status: "sent",
			results: [{ token: "invalid-token", success: false }],
		});
		expect(tokenRepository.deactivateInvalidTokens).toHaveBeenCalledWith(["invalid-token"]);
		expect(notificationCache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(pushProvider.sendBatch).toHaveBeenCalledWith([
			{
				token: "invalid-token",
				title: "title",
				body: "body",
				categoryId: "TEST",
			},
		]);
	});

	it("배치는 generic·feature 토큰을 각 계약으로 선택하고 dispatch별 결과와 skip 이유를 보존한다", async () => {
		activeTokenReader.findByUserIds.mockResolvedValue(
			new Map([
				["generic", ["generic-token"]],
				["feature", ["ignored-generic-token"]],
			]),
		);
		tokenRepository.findActivePushTokensByUsers.mockResolvedValue([
			pushToken({
				userId: "feature",
				token: "feature-token",
				payloadVersion: 2,
				appVersion: "1.8.0",
			}),
			pushToken({
				userId: "unsupported",
				token: "unsupported-token",
				payloadVersion: 1,
				appVersion: "1.9.0",
			}),
		]);
		pushProvider.sendBatch.mockResolvedValue({
			total: 2,
			successCount: 2,
			failureCount: 0,
			results: [
				{ token: "generic-token", success: true, ticketId: "ticket-1" },
				{ token: "feature-token", success: true, ticketId: "ticket-2" },
			],
			invalidTokens: [],
		});

		const prepared = await service.prepareBatchDelivery([
			batchPayload({ userId: "generic", dispatchId: 1 }),
			batchPayload({ userId: "feature", dispatchId: 2, requiresFeatureCapability: true }),
			batchPayload({ userId: "missing", dispatchId: 3 }),
			batchPayload({ userId: "unsupported", dispatchId: 4, requiresFeatureCapability: true }),
		]);
		if (prepared.status !== "ready") throw new Error("Expected a prepared batch delivery");
		const result = await service.sendPreparedBatch(prepared);

		expect(pushProvider.sendBatch).toHaveBeenCalledWith([
			{
				token: "generic-token",
				title: "title-1",
				body: "body-1",
				data: { dispatchId: 1 },
			},
			{
				token: "feature-token",
				title: "title-2",
				body: "body-2",
				data: { dispatchId: 2 },
			},
		]);
		expect([...prepared.attemptedDispatchIds]).toEqual([1, 2]);
		expect(result.resultsByDispatch.get(1)).toEqual([
			{ token: "generic-token", success: true, ticketId: "ticket-1" },
		]);
		expect(result.resultsByDispatch.get(2)).toEqual([
			{ token: "feature-token", success: true, ticketId: "ticket-2" },
		]);
		expect(prepared.skippedDispatches).toEqual([
			{ dispatchId: 3, reason: "NO_ACTIVE_TOKEN" },
			{ dispatchId: 4, reason: "UNSUPPORTED_APP_CAPABILITY" },
		]);
	});

	it("배치 invalid token은 기존 계약대로 배치 수신자 전체 token cache를 무효화한다", async () => {
		activeTokenReader.findByUserIds.mockResolvedValue(
			new Map([
				["user-1", ["invalid-token"]],
				["user-2", ["valid-token"]],
			]),
		);
		pushProvider.sendBatch.mockResolvedValue({
			total: 2,
			successCount: 1,
			failureCount: 1,
			results: [
				{ token: "invalid-token", success: false },
				{ token: "valid-token", success: true },
			],
			invalidTokens: ["invalid-token"],
		});

		const prepared = await service.prepareBatchDelivery([
			batchPayload({ userId: "user-1", dispatchId: 1 }),
			batchPayload({ userId: "user-2", dispatchId: 2 }),
		]);
		if (prepared.status !== "ready") throw new Error("Expected a prepared batch delivery");
		await service.sendPreparedBatch(prepared);

		expect(tokenRepository.deactivateInvalidTokens).toHaveBeenCalledWith(["invalid-token"]);
		expect(notificationCache.invalidatePushTokens).toHaveBeenCalledTimes(2);
		expect(notificationCache.invalidatePushTokens).toHaveBeenCalledWith("user-1");
		expect(notificationCache.invalidatePushTokens).toHaveBeenCalledWith("user-2");
	});

	it("배치 provider transport 오류는 token 상태를 변경하지 않고 같은 오류를 재전파한다", async () => {
		// Given
		activeTokenReader.findByUserIds.mockResolvedValue(
			new Map([["user-1", ["ExponentPushToken[user-1]"]]]),
		);
		const prepared = await service.prepareBatchDelivery([
			batchPayload({ userId: "user-1", dispatchId: 1 }),
		]);
		if (prepared.status !== "ready") throw new Error("Expected a prepared batch delivery");
		const transportError = new RetryablePushProviderTransportError(
			{
				providerName: "expo",
				resolvedPayloadCountBeforeFailure: 0,
				acceptedTicketCountBeforeFailure: 0,
				unconfirmedPayloadCount: 1,
				unattemptedPayloadCount: 0,
			},
			{ cause: new Error("network unavailable") },
		);
		pushProvider.sendBatch.mockRejectedValue(transportError);

		// When / Then
		await expect(service.sendPreparedBatch(prepared)).rejects.toBe(transportError);
		expect(tokenRepository.deactivateInvalidTokens).not.toHaveBeenCalled();
		expect(notificationCache.invalidatePushTokens).not.toHaveBeenCalled();
	});
});
