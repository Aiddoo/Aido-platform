/**
 * AccountPurgeJob 단위 테스트
 *
 * @description
 * 계정 정리 잡의 스케줄러 등록, catch-up, hard delete 로직을 검증한다.
 * 유예 기간 경과 사용자 삭제, 개별 실패 시 나머지 처리 계속을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test account-purge.job.spec.ts
 * ```
 */

import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { type TransactionCallback } from "@test/mocks";
import type { Queue } from "bullmq";
import { DatabaseService } from "@/shared/infrastructure/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "../processors/account-purge.processor";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { AccountPurgeJob } from "./account-purge.job";

describe("AccountPurgeJob — 계정 삭제 잡", () => {
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
				add: jest.fn().mockResolvedValue(undefined),
				upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		userRepo = unitRef.get(UserRepository);
		securityLogRepo = unitRef.get(SecurityLogRepository);
		database = unitRef.get(DatabaseService);
		mockQueue = unitRef.get(getQueueToken(ACCOUNT_PURGE_QUEUE));
		mockProcessor = unitRef.get(AccountPurgeProcessor);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("onModuleInit 스케줄러 등록", () => {
		it("서버 시작 시 일일 계정 정리 스케줄러를 등록해야 한다", async () => {
			// Given — 02:00 KST (catch-up 미발동)
			jest.useFakeTimers({ now: new Date("2026-03-09T02:00:00+09:00") });

			// When
			job.onModuleInit();
			await job.schedulerRegistration;

			// Then
			expect(mockQueue.upsertJobScheduler).toHaveBeenCalledWith(
				"daily-account-purge-scheduler",
				{ pattern: "0 3 * * *", tz: "Asia/Seoul" },
				{ name: "purge-accounts", data: {} },
			);
		});

		it("Processor에 자신을 등록해야 한다", async () => {
			// Given
			jest.useFakeTimers({ now: new Date("2026-03-09T02:00:00+09:00") });

			// When
			job.onModuleInit();
			await job.schedulerRegistration;

			// Then
			expect(mockProcessor.setPurgeJob).toHaveBeenCalledWith(job);
		});

		it("Redis가 무응답이어도 부팅(onModuleInit)이 블로킹되지 않는다", () => {
			// Given — Redis 다운: 등록 명령이 영원히 pending
			(mockQueue.upsertJobScheduler as jest.Mock).mockReturnValue(
				new Promise(() => {}),
			);

			// When — 동기 반환 (await 없이 즉시 완료돼야 부팅이 안 막힌다)
			const result = job.onModuleInit();

			// Then
			expect(result).toBeUndefined();
			expect(mockProcessor.setPurgeJob).toHaveBeenCalledWith(job);
		});

		it("스케줄러 등록 실패 시 로그만 남기고 throw하지 않는다", async () => {
			// Given
			(mockQueue.upsertJobScheduler as jest.Mock).mockRejectedValue(
				new Error("Connection is closed."),
			);

			// When / Then — 부팅 실패로 이어지지 않아야 한다
			job.onModuleInit();
			await expect(job.schedulerRegistration).resolves.toBeUndefined();
		});
	});

	describe("catch-up on startup", () => {
		it("03:00 이후 시작 시 purge 잡을 추가해야 한다", async () => {
			// Given — 05:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T05:00:00+09:00") });

			// When
			job.onModuleInit();
			await job.schedulerRegistration;

			// Then
			expect(mockQueue.add).toHaveBeenCalledWith(
				"purge-accounts",
				{},
				{ jobId: "purge_2026-03-09" },
			);
		});

		it("03:00 이전에 시작 시 catch-up하지 않아야 한다", async () => {
			// Given — 02:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T02:00:00+09:00") });

			// When
			job.onModuleInit();
			await job.schedulerRegistration;

			// Then
			expect(mockQueue.add).not.toHaveBeenCalled();
		});
	});

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
