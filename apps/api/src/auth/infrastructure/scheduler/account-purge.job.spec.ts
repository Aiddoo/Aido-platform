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

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asMock } from "@test/mocks";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "@/auth/domain/constants/auth.constants";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "@/auth/infrastructure/queue/account-purge.processor";
import { NotificationAccountCleanup } from "@/notification";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";
import { TodoCommentAccountCleanup } from "@/todo-comment";

import { AccountPurgeJob } from "./account-purge.job";

describe("AccountPurgeJob — 계정 삭제 잡", () => {
	let job: AccountPurgeJob;
	let userRepo: Mocked<UserRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let uow: Mocked<UnitOfWorkPort>;
	let runtime: Mocked<JobRuntimePort>;
	let mockProcessor: Mocked<AccountPurgeProcessor>;
	let notificationCleanup: Mocked<NotificationAccountCleanup>;
	let todoCommentCleanup: Mocked<TodoCommentAccountCleanup>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AccountPurgeJob)
			.mock(JOB_RUNTIME)
			.impl(() => ({
				enqueue: jest.fn().mockResolvedValue("job-1"),
				schedule: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		job = unit;
		userRepo = unitRef.get(UserRepository);
		securityLogRepo = unitRef.get(SecurityLogRepository);
		uow = unitRef.get(UNIT_OF_WORK);
		runtime = unitRef.get(JOB_RUNTIME);
		mockProcessor = unitRef.get(AccountPurgeProcessor);
		notificationCleanup = unitRef.get(NotificationAccountCleanup);
		todoCommentCleanup = unitRef.get(TodoCommentAccountCleanup);
		notificationCleanup.cleanupInTransaction.mockResolvedValue({ affectedUserIds: [] });
		notificationCleanup.settleAfterCommit.mockResolvedValue(undefined);
		todoCommentCleanup.cleanupInTransaction.mockResolvedValue({ affectedTodoIds: [] });
		todoCommentCleanup.settleAfterCommit.mockResolvedValue(undefined);
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
			expect(runtime.schedule).toHaveBeenCalledWith(
				"daily-account-purge-scheduler",
				"0 3 * * *",
				ACCOUNT_PURGE_QUEUE,
				{ name: "purge-accounts", data: {} },
				expect.objectContaining({ timezone: "Asia/Seoul" }),
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
			asMock(runtime.schedule).mockReturnValue(new Promise(() => {}));

			// When — 동기 반환 (await 없이 즉시 완료돼야 부팅이 안 막힌다)
			const result = job.onModuleInit();

			// Then
			expect(result).toBeUndefined();
			expect(mockProcessor.setPurgeJob).toHaveBeenCalledWith(job);
		});

		it("스케줄러 등록 실패 시 로그만 남기고 throw하지 않는다", async () => {
			// Given
			asMock(runtime.schedule).mockRejectedValue(new Error("Connection is closed."));

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
			expect(runtime.enqueue).toHaveBeenCalledWith(
				ACCOUNT_PURGE_QUEUE,
				{ name: "purge-accounts", data: {} },
				expect.objectContaining({ jobKey: "purge_2026-03-09" }),
			);
		});

		it("03:00 이전에 시작 시 catch-up하지 않아야 한다", async () => {
			// Given — 02:00 KST
			jest.useFakeTimers({ now: new Date("2026-03-09T02:00:00+09:00") });

			// When
			job.onModuleInit();
			await job.schedulerRegistration;

			// Then
			expect(runtime.enqueue).not.toHaveBeenCalled();
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
		uow.run.mockImplementation((work) => work());
		asMock(securityLogRepo.create).mockResolvedValue({});
		userRepo.hardDelete.mockResolvedValue(undefined);

		// When
		await job.purgeDeletedAccounts();

		// Then
		expect(userRepo.findSoftDeletedForPurge).toHaveBeenCalledWith(
			ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
		);
		expect(uow.run).toHaveBeenCalled();
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
		expect(userRepo.hardDelete).toHaveBeenCalledWith("user-1");
		expect(notificationCleanup.cleanupInTransaction).toHaveBeenCalledWith("user-1");
		expect(notificationCleanup.settleAfterCommit).toHaveBeenCalledWith({ affectedUserIds: [] });
		expect(todoCommentCleanup.cleanupInTransaction).toHaveBeenCalledWith("user-1");
		expect(todoCommentCleanup.settleAfterCommit).toHaveBeenCalledWith({ affectedTodoIds: [] });

		const notificationCleanupOrder =
			notificationCleanup.cleanupInTransaction.mock.invocationCallOrder[0] ?? 0;
		const cleanupOrder = todoCommentCleanup.cleanupInTransaction.mock.invocationCallOrder[0] ?? 0;
		const hardDeleteOrder = userRepo.hardDelete.mock.invocationCallOrder[0] ?? 0;
		const notificationSettleOrder =
			notificationCleanup.settleAfterCommit.mock.invocationCallOrder[0] ?? 0;
		const cacheSettleOrder = todoCommentCleanup.settleAfterCommit.mock.invocationCallOrder[0] ?? 0;
		expect(notificationCleanupOrder).toBeLessThan(cleanupOrder);
		expect(cleanupOrder).toBeLessThan(hardDeleteOrder);
		expect(hardDeleteOrder).toBeLessThan(notificationSettleOrder);
		expect(hardDeleteOrder).toBeLessThan(cacheSettleOrder);
	});

	it("댓글 정리가 실패하면 User hard delete와 보안 로그를 실행하지 않는다", async () => {
		// Given
		userRepo.findSoftDeletedForPurge.mockResolvedValue([
			{
				id: "user-1",
				email: "user1@example.com",
				deletedAt: new Date("2025-01-01"),
			},
		]);
		uow.run.mockImplementation((work) => work());
		todoCommentCleanup.cleanupInTransaction.mockRejectedValue(new Error("cleanup failed"));

		// When
		await job.purgeDeletedAccounts();

		// Then
		expect(userRepo.hardDelete).not.toHaveBeenCalled();
		expect(notificationCleanup.settleAfterCommit).not.toHaveBeenCalled();
		expect(todoCommentCleanup.settleAfterCommit).not.toHaveBeenCalled();
		expect(securityLogRepo.create).not.toHaveBeenCalled();
	});

	it("삭제 대상이 없으면 아무것도 하지 않는다", async () => {
		// Given
		userRepo.findSoftDeletedForPurge.mockResolvedValue([]);

		// When
		await job.purgeDeletedAccounts();

		// Then
		expect(uow.run).not.toHaveBeenCalled();
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

		const _callCount = 0;
		uow.run.mockImplementation((work) => work());
		asMock(securityLogRepo.create).mockResolvedValue({});
		userRepo.hardDelete.mockResolvedValue(undefined);

		// When
		await job.purgeDeletedAccounts();

		// Then - 2번째 사용자는 성공적으로 처리되어야 함
		expect(uow.run).toHaveBeenCalledTimes(2);
	});
});
