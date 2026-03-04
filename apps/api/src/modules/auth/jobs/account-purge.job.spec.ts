import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { type TransactionCallback } from "@test/mocks";
import type { Queue } from "bullmq";
import { DatabaseService } from "@/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "../processors/account-purge.processor";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { AccountPurgeJob } from "./account-purge.job";

describe("AccountPurgeJob", () => {
	let job: AccountPurgeJob;
	let userRepo: Mocked<UserRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let database: Mocked<DatabaseService>;
	let mockQueue: Mocked<Queue>;
	let mockProcessor: Mocked<AccountPurgeProcessor>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AccountPurgeJob)
			.mock(getQueueToken(ACCOUNT_PURGE_QUEUE))
			.impl(() => ({
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		userRepo = unitRef.get(UserRepository) as unknown as Mocked<UserRepository>;
		securityLogRepo = unitRef.get(
			SecurityLogRepository,
		) as unknown as Mocked<SecurityLogRepository>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		mockQueue = unitRef.get(getQueueToken(ACCOUNT_PURGE_QUEUE));
		mockProcessor = unitRef.get(AccountPurgeProcessor);
	});

	// =========================================================================
	// onModuleInit 스케줄러 등록
	// =========================================================================

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 일일 계정 정리 스케줄러를 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"daily-account-purge-scheduler",
				{ pattern: "0 3 * * *", tz: "Asia/Seoul" },
				{ name: "purge-accounts", data: {} },
			);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// When
			await job.onModuleInit();

			// Then
			expect(mockProcessor.setPurgeJob).toHaveBeenCalledWith(job);
		});
	});

	// =========================================================================
	// purgeDeletedAccounts
	// =========================================================================

	it("유예 기간이 지난 사용자를 hard delete 한다", async () => {
		// Given
		const deletedUsers = [
			{
				id: "user-1",
				email: "user1@example.com",
				deletedAt: new Date("2025-01-01"),
			},
		];
		userRepo.findSoftDeletedForPurge.mockResolvedValue(deletedUsers);
		database.$transaction.mockImplementation(
			async (callback: TransactionCallback) => callback({} as never),
		);
		securityLogRepo.create.mockResolvedValue({} as never);
		userRepo.hardDelete.mockResolvedValue(undefined);

		// When
		await job.purgeDeletedAccounts();

		// Then
		expect(userRepo.findSoftDeletedForPurge).toHaveBeenCalledWith(
			ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
		);
		expect(database.$transaction).toHaveBeenCalled();
		expect(securityLogRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
				ipAddress: "SYSTEM",
				userAgent: "AccountPurgeJob",
				metadata: expect.objectContaining({
					purgedUserId: "user-1",
				}),
			}),
		);
		expect(userRepo.hardDelete).toHaveBeenCalledWith(
			"user-1",
			expect.any(Object),
		);
	});

	it("삭제 대상이 없으면 아무것도 하지 않는다", async () => {
		// Given
		userRepo.findSoftDeletedForPurge.mockResolvedValue([]);

		// When
		await job.purgeDeletedAccounts();

		// Then
		expect(database.$transaction).not.toHaveBeenCalled();
	});

	it("한 명의 삭제가 실패해도 나머지를 계속 처리한다", async () => {
		// Given
		const deletedUsers = [
			{
				id: "user-1",
				email: "user1@example.com",
				deletedAt: new Date("2025-01-01"),
			},
			{
				id: "user-2",
				email: "user2@example.com",
				deletedAt: new Date("2025-01-01"),
			},
		];
		userRepo.findSoftDeletedForPurge.mockResolvedValue(deletedUsers);

		let callCount = 0;
		database.$transaction.mockImplementation(
			async (callback: TransactionCallback) => {
				callCount++;
				if (callCount === 1) {
					throw new Error("DB error");
				}
				return callback({} as never);
			},
		);
		securityLogRepo.create.mockResolvedValue({} as never);
		userRepo.hardDelete.mockResolvedValue(undefined);

		// When
		await job.purgeDeletedAccounts();

		// Then - 2번째 사용자는 성공적으로 처리되어야 함
		expect(database.$transaction).toHaveBeenCalledTimes(2);
	});
});
