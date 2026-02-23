import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/common/lock/interfaces/lock.interface";
import { DatabaseService } from "@/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { AccountPurgeJob } from "./account-purge.job";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionCallback = (tx: any) => Promise<any>;

describe("AccountPurgeJob", () => {
	let job: AccountPurgeJob;
	let userRepo: Mocked<UserRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let database: Mocked<DatabaseService>;
	let lockProvider: Mocked<ILockProvider>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AccountPurgeJob).compile();

		job = unit;
		userRepo = unitRef.get(UserRepository) as unknown as Mocked<UserRepository>;
		securityLogRepo = unitRef.get(
			SecurityLogRepository,
		) as unknown as Mocked<SecurityLogRepository>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		lockProvider = unitRef.get(
			LOCK_PROVIDER,
		) as unknown as Mocked<ILockProvider>;

		// Lock을 항상 획득 성공하도록 mock
		lockProvider.acquire.mockResolvedValue(jest.fn());
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
