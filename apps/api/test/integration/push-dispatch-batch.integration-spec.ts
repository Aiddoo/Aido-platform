import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaPushDeliveryRepository } from "@/notification/infrastructure/persistence/prisma-push-delivery.repository";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { TestDatabase } from "../setup/test-database";

describe("푸시 dispatch 배치 저장 통합 테스트 (실제 DB)", () => {
	let testDb: TestDatabase;
	let prisma: PrismaClient;
	let repository: PrismaPushDeliveryRepository;

	beforeAll(async () => {
		testDb = new TestDatabase();
		prisma = await testDb.start();
		const txHost = {
			tx: prisma,
		} as unknown as TransactionHost<TransactionalAdapterPrisma<DatabaseService>>;
		repository = new PrismaPushDeliveryRepository(txHost);
	}, 60_000);

	beforeEach(async () => {
		await testDb.cleanup();
	});

	afterAll(async () => {
		await testDb.stop();
	});

	it("생성·재시도·전송 결과·receipt를 실제 PostgreSQL에서 일괄 기록한다", async () => {
		// Given
		const user = await prisma.user.create({
			data: {
				id: "push-batch-user",
				email: "push-batch@example.com",
				userTag: "PUSH0001",
				status: "ACTIVE",
			},
		});
		const notifications = await Promise.all([
			prisma.notification.create({
				data: {
					userId: user.id,
					type: "SYSTEM_NOTICE",
					title: "성공 알림",
					body: "성공 본문",
				},
			}),
			prisma.notification.create({
				data: {
					userId: user.id,
					type: "SYSTEM_NOTICE",
					title: "실패 알림",
					body: "실패 본문",
				},
			}),
		]);
		const tokens = await Promise.all([
			prisma.pushToken.create({
				data: {
					userId: user.id,
					token: "ExponentPushToken[batch-success]",
					deviceId: "batch-success",
					platform: "IOS",
					payloadVersion: 2,
					appVersion: "1.8.0",
				},
			}),
			prisma.pushToken.create({
				data: {
					userId: user.id,
					token: "ExponentPushToken[batch-invalid]",
					deviceId: "batch-invalid",
					platform: "ANDROID",
					payloadVersion: 2,
					appVersion: "1.8.0",
				},
			}),
		]);
		const inputs = notifications.map((notification) => ({
			notificationId: notification.id,
			userId: user.id,
			purpose: "ENGAGEMENT" as const,
			campaignKey: "feature-discovery-2026-08",
			timezone: "Asia/Seoul",
			localDate: new Date("2026-07-26T00:00:00.000Z"),
		}));

		// When - 최초 생성 후 스킵 상태를 만들고 같은 notificationId로 재시도한다
		const firstDispatches = await repository.createPushDispatches(inputs);
		await repository.markPushDispatchesSkipped(
			firstDispatches.map((dispatch) => ({
				dispatchId: dispatch.id,
				reason: "PUSH_DISABLED" as const,
			})),
		);
		const retriedDispatches = await repository.createPushDispatches(inputs);
		const successfulDispatch = retriedDispatches[0];
		const failedDispatch = retriedDispatches[1];
		const successfulToken = tokens[0];
		const invalidToken = tokens[1];
		if (!successfulDispatch || !failedDispatch || !successfulToken || !invalidToken) {
			throw new Error("푸시 배치 테스트 fixture 생성에 실패했습니다.");
		}
		await repository.recordPushDeliveryResultsBatch([
			{
				dispatchId: successfulDispatch.id,
				results: [
					{
						token: successfulToken.token,
						success: true,
						ticketId: "ticket-success",
					},
				],
			},
			{
				dispatchId: failedDispatch.id,
				results: [
					{
						token: invalidToken.token,
						success: false,
						ticketId: "ticket-invalid",
						errorCode: "DeviceNotRegistered",
					},
				],
			},
		]);
		const invalidTokens = await repository.recordPushReceipts([
			{ ticketId: "ticket-success", delivered: true },
			{
				ticketId: "ticket-invalid",
				delivered: false,
				errorCode: "DeviceNotRegistered",
			},
		]);

		// Then
		expect(retriedDispatches).toEqual(firstDispatches);
		const persistedDispatches = await prisma.pushDispatch.findMany({
			orderBy: { id: "asc" },
		});
		expect(persistedDispatches).toHaveLength(2);
		expect(persistedDispatches[0]?.status).toBe("SENT");
		expect(persistedDispatches[0]?.skipReason).toBeNull();
		expect(persistedDispatches[1]?.status).toBe("FAILED");
		expect(persistedDispatches[1]?.skipReason).toBeNull();

		const attempts = await prisma.pushDeliveryAttempt.findMany({
			orderBy: { id: "asc" },
		});
		expect(attempts.map((attempt) => attempt.status)).toEqual(["DELIVERED", "FAILED"]);
		expect(attempts.every((attempt) => attempt.receiptCheckedAt !== null)).toBe(true);
		expect(invalidTokens).toEqual(["ExponentPushToken[batch-invalid]"]);
	});
});
