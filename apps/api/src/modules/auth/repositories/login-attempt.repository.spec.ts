import { Test, type TestingModule } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { LoginAttempt } from "@/generated/prisma/client";

import { LoginAttemptRepository } from "./login-attempt.repository";

describe("LoginAttemptRepository", () => {
	let repository: LoginAttemptRepository;
	let mockDatabase: {
		loginAttempt: {
			create: jest.Mock;
			count: jest.Mock;
			findFirst: jest.Mock;
			deleteMany: jest.Mock;
		};
	};

	const mockSuccessfulAttempt: LoginAttempt = {
		id: 1,
		email: "user@example.com",
		ipAddress: "192.168.1.1",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		success: true,
		failureReason: null,
		createdAt: new Date("2025-01-15T10:00:00Z"),
	};

	const mockFailedAttempt: LoginAttempt = {
		id: 2,
		email: "user@example.com",
		ipAddress: "192.168.1.1",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		success: false,
		failureReason: "INVALID_PASSWORD",
		createdAt: new Date("2025-01-15T09:00:00Z"),
	};

	beforeEach(async () => {
		mockDatabase = {
			loginAttempt: {
				create: jest.fn(),
				count: jest.fn(),
				findFirst: jest.fn(),
				deleteMany: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LoginAttemptRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<LoginAttemptRepository>(LoginAttemptRepository);
	});

	describe("create", () => {
		it("성공한 로그인 시도를 기록한다", async () => {
			// Given
			const createData = {
				email: "user@example.com",
				ipAddress: "192.168.1.1",
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
				success: true,
			};
			mockDatabase.loginAttempt.create.mockResolvedValue(mockSuccessfulAttempt);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockSuccessfulAttempt);
			expect(mockDatabase.loginAttempt.create).toHaveBeenCalledWith({
				data: {
					email: createData.email,
					ipAddress: createData.ipAddress,
					userAgent: createData.userAgent,
					success: createData.success,
					failureReason: undefined,
				},
			});
		});

		it("실패한 로그인 시도를 기록한다", async () => {
			// Given
			const createData = {
				email: "user@example.com",
				ipAddress: "192.168.1.1",
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
				success: false,
				failureReason: "INVALID_PASSWORD",
			};
			mockDatabase.loginAttempt.create.mockResolvedValue(mockFailedAttempt);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockFailedAttempt);
			expect(mockDatabase.loginAttempt.create).toHaveBeenCalledWith({
				data: {
					email: createData.email,
					ipAddress: createData.ipAddress,
					userAgent: createData.userAgent,
					success: createData.success,
					failureReason: createData.failureReason,
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 기록한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.loginAttempt.create.mockResolvedValue(mockSuccessfulAttempt);
			const createData = {
				email: "user@example.com",
				ipAddress: "192.168.1.1",
				userAgent: "Mozilla/5.0",
				success: true,
			};

			// When
			const result = await repository.create(createData, asTxClient(mockTx));

			// Then
			expect(result).toEqual(mockSuccessfulAttempt);
			expect(mockTx.loginAttempt.create).toHaveBeenCalled();
			expect(mockDatabase.loginAttempt.create).not.toHaveBeenCalled();
		});
	});

	describe("countRecentFailuresByEmail", () => {
		const since = new Date("2025-01-15T00:00:00Z");

		it("이메일 기준 최근 실패 횟수를 카운트한다", async () => {
			// Given
			mockDatabase.loginAttempt.count.mockResolvedValue(3);

			// When
			const result = await repository.countRecentFailuresByEmail(
				"user@example.com",
				since,
			);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.loginAttempt.count).toHaveBeenCalledWith({
				where: {
					email: "user@example.com",
					success: false,
					createdAt: { gte: since },
				},
			});
		});

		it("실패 기록이 없으면 0을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.count.mockResolvedValue(0);

			// When
			const result = await repository.countRecentFailuresByEmail(
				"clean@example.com",
				since,
			);

			// Then
			expect(result).toBe(0);
		});
	});

	describe("countRecentFailuresByIp", () => {
		const since = new Date("2025-01-15T00:00:00Z");

		it("IP 기준 최근 실패 횟수를 카운트한다", async () => {
			// Given
			mockDatabase.loginAttempt.count.mockResolvedValue(5);

			// When
			const result = await repository.countRecentFailuresByIp(
				"192.168.1.1",
				since,
			);

			// Then
			expect(result).toBe(5);
			expect(mockDatabase.loginAttempt.count).toHaveBeenCalledWith({
				where: {
					ipAddress: "192.168.1.1",
					success: false,
					createdAt: { gte: since },
				},
			});
		});

		it("실패 기록이 없으면 0을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.count.mockResolvedValue(0);

			// When
			const result = await repository.countRecentFailuresByIp(
				"10.0.0.1",
				since,
			);

			// Then
			expect(result).toBe(0);
		});
	});

	describe("findLastSuccessByEmail", () => {
		it("이메일의 마지막 성공 기록을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.findFirst.mockResolvedValue(
				mockSuccessfulAttempt,
			);

			// When
			const result =
				await repository.findLastSuccessByEmail("user@example.com");

			// Then
			expect(result).toEqual(mockSuccessfulAttempt);
			expect(mockDatabase.loginAttempt.findFirst).toHaveBeenCalledWith({
				where: {
					email: "user@example.com",
					success: true,
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("성공 기록이 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.findLastSuccessByEmail("new@example.com");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findLastFailureByEmail", () => {
		it("이메일의 마지막 실패 기록을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.findFirst.mockResolvedValue(mockFailedAttempt);

			// When
			const result =
				await repository.findLastFailureByEmail("user@example.com");

			// Then
			expect(result).toEqual(mockFailedAttempt);
			expect(mockDatabase.loginAttempt.findFirst).toHaveBeenCalledWith({
				where: {
					email: "user@example.com",
					success: false,
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("실패 기록이 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.findFirst.mockResolvedValue(null);

			// When
			const result =
				await repository.findLastFailureByEmail("clean@example.com");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("clearRecentFailuresByEmail", () => {
		it("감사 로그 목적으로 실제 삭제하지 않는다", async () => {
			// Given
			const since = new Date("2025-01-15T00:00:00Z");

			// When
			await repository.clearRecentFailuresByEmail("user@example.com", since);

			// Then
			// 메서드가 no-op이므로 DB 호출이 없어야 함
			expect(mockDatabase.loginAttempt.deleteMany).not.toHaveBeenCalled();
		});
	});

	describe("deleteOld", () => {
		it("기본 30일 이전 기록을 삭제한다", async () => {
			// Given
			mockDatabase.loginAttempt.deleteMany.mockResolvedValue({ count: 100 });

			// When
			const result = await repository.deleteOld();

			// Then
			expect(result).toBe(100);
			expect(mockDatabase.loginAttempt.deleteMany).toHaveBeenCalledWith({
				where: {
					createdAt: { lt: expect.any(Date) },
				},
			});
		});

		it("지정된 보관 기간으로 삭제한다", async () => {
			// Given
			mockDatabase.loginAttempt.deleteMany.mockResolvedValue({ count: 50 });

			// When
			const result = await repository.deleteOld(7);

			// Then
			expect(result).toBe(50);
			expect(mockDatabase.loginAttempt.deleteMany).toHaveBeenCalledWith({
				where: {
					createdAt: { lt: expect.any(Date) },
				},
			});
		});

		it("삭제할 기록이 없으면 0을 반환한다", async () => {
			// Given
			mockDatabase.loginAttempt.deleteMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.deleteOld();

			// Then
			expect(result).toBe(0);
		});
	});
});
