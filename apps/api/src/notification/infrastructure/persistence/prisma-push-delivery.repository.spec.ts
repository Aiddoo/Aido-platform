import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { asMock, createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { PrismaPushDeliveryRepository } from "./prisma-push-delivery.repository";

describe("PrismaPushDeliveryRepository", () => {
	let repository: PrismaPushDeliveryRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		db = createMockPrisma();
		const { unit } = await TestBed.solitary(PrismaPushDeliveryRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();
		repository = unit;
	});

	it("단건 dispatch를 notificationId로 멱등 upsert한다", async () => {
		asMock(db.pushDispatch.upsert).mockResolvedValue({ id: 41 });
		const input = {
			notificationId: 101,
			userId: "user-1",
			purpose: "TRANSACTIONAL" as const,
			timezone: "Asia/Seoul",
			localDate: new Date("2026-07-26T00:00:00.000Z"),
		};

		await expect(repository.createPushDispatch(input)).resolves.toEqual({ id: 41 });
		expect(db.pushDispatch.upsert).toHaveBeenCalledWith({
			where: { notificationId: 101 },
			create: { ...input, status: "PROCESSING" },
			update: { status: "PROCESSING", skipReason: null },
			select: { id: true },
		});
	});

	it("배치 dispatch를 하나의 멱등 SQL로 생성한다", async () => {
		const expected = [
			{ id: 41, notificationId: 101 },
			{ id: 42, notificationId: 102 },
		];
		asMock(db.$queryRaw).mockResolvedValue(expected);

		await expect(
			repository.createPushDispatches([
				{
					notificationId: 101,
					userId: "user-1",
					purpose: "TRANSACTIONAL",
					timezone: "Asia/Seoul",
					localDate: new Date("2026-07-26T00:00:00.000Z"),
				},
				{
					notificationId: 102,
					userId: "user-2",
					purpose: "ENGAGEMENT",
					campaignKey: "campaign-1",
					timezone: "UTC",
					localDate: new Date("2026-07-26T00:00:00.000Z"),
				},
			]),
		).resolves.toEqual(expected);
		expect(db.$queryRaw).toHaveBeenCalledTimes(1);
	});

	it("빈 dispatch 배치는 SQL을 실행하지 않는다", async () => {
		await expect(repository.createPushDispatches([])).resolves.toEqual([]);
		expect(db.$queryRaw).not.toHaveBeenCalled();
	});

	it("skip 상태를 stable reason과 함께 저장한다", async () => {
		asMock(db.pushDispatch.update).mockResolvedValue({ id: 41 });

		await repository.markPushDispatchSkipped(41, "NO_ACTIVE_TOKEN");
		expect(db.pushDispatch.update).toHaveBeenCalledWith({
			where: { id: 41 },
			data: { status: "SKIPPED", skipReason: "NO_ACTIVE_TOKEN" },
		});
	});

	it("배치 skip은 사용자 수가 아니라 reason 수만큼 갱신한다", async () => {
		asMock(db.pushDispatch.updateMany).mockResolvedValue({ count: 1 });

		await repository.markPushDispatchesSkipped([
			{ dispatchId: 41, reason: "PUSH_DISABLED" },
			{ dispatchId: 42, reason: "PUSH_DISABLED" },
			{ dispatchId: 43, reason: "RATE_LIMITED" },
		]);
		expect(db.pushDispatch.updateMany).toHaveBeenCalledTimes(2);
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { id: { in: [41, 42] } },
			data: { status: "SKIPPED", skipReason: "PUSH_DISABLED" },
		});
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { id: { in: [43] } },
			data: { status: "SKIPPED", skipReason: "RATE_LIMITED" },
		});
	});

	it("예상하지 못한 실패는 PROCESSING dispatch만 FAILED로 전이한다", async () => {
		asMock(db.pushDispatch.updateMany).mockResolvedValue({ count: 2 });

		await repository.markPushDispatchFailed([41, 42], "UNEXPECTED_DISPATCH_ERROR");
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { id: { in: [41, 42] }, status: "PROCESSING" },
			data: { status: "FAILED", skipReason: "UNEXPECTED_DISPATCH_ERROR" },
		});
	});

	it("전송 결과를 배치 조회·attempt 생성·dispatch 상태로 기록한다", async () => {
		asMock(db.pushToken.findMany).mockResolvedValue([
			{ id: 1, token: "ExponentPushToken[success]" },
			{ id: 2, token: "ExponentPushToken[failed]" },
		]);
		asMock(db.pushDeliveryAttempt.createMany).mockResolvedValue({ count: 2 });
		asMock(db.pushDispatch.updateMany).mockResolvedValue({ count: 1 });

		await repository.recordPushDeliveryResultsBatch([
			{
				dispatchId: 41,
				results: [{ token: "ExponentPushToken[success]", success: true, ticketId: "ticket-ok" }],
			},
			{
				dispatchId: 42,
				results: [
					{
						token: "ExponentPushToken[failed]",
						success: false,
						errorCode: "MessageTooBig",
					},
				],
			},
		]);
		expect(db.pushToken.findMany).toHaveBeenCalledTimes(1);
		expect(db.pushDeliveryAttempt.createMany).toHaveBeenCalledTimes(1);
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { id: { in: [41] } },
			data: { status: "SENT", sentAt: expect.any(Date) },
		});
		expect(db.pushDispatch.updateMany).toHaveBeenCalledWith({
			where: { id: { in: [42] } },
			data: { status: "FAILED" },
		});
	});

	it("pending receipt를 오래된 순으로 제한 조회한다", async () => {
		asMock(db.pushDeliveryAttempt.findMany).mockResolvedValue([
			{ expoTicketId: "ticket-1", pushToken: { token: "token-1" } },
			{ expoTicketId: null, pushToken: { token: "token-2" } },
		]);

		await expect(repository.findPendingPushReceipts(900)).resolves.toEqual([
			{ ticketId: "ticket-1", token: "token-1" },
		]);
		expect(db.pushDeliveryAttempt.findMany).toHaveBeenCalledWith({
			where: { status: "TICKET_ACCEPTED", expoTicketId: { not: null } },
			take: 900,
			orderBy: { createdAt: "asc" },
			select: { expoTicketId: true, pushToken: { select: { token: true } } },
		});
	});

	it("Expo receipt를 한 SQL로 기록하고 무효 토큰만 반환한다", async () => {
		asMock(db.$executeRaw).mockResolvedValue(2);
		asMock(db.pushDeliveryAttempt.findMany).mockResolvedValue([
			{ pushToken: { token: "ExponentPushToken[invalid]" } },
		]);

		await expect(
			repository.recordPushReceipts([
				{ ticketId: "ticket-success", delivered: true },
				{
					ticketId: "ticket-invalid",
					delivered: false,
					errorCode: "DeviceNotRegistered",
				},
			]),
		).resolves.toEqual(["ExponentPushToken[invalid]"]);
		expect(db.$executeRaw).toHaveBeenCalledTimes(1);
		expect(db.pushDeliveryAttempt.updateMany).not.toHaveBeenCalled();
	});
});
