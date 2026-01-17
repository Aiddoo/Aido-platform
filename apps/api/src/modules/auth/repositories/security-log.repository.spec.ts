import { Test, type TestingModule } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { SecurityLog } from "@/generated/prisma/client";

import { SecurityLogRepository } from "./security-log.repository";

describe("SecurityLogRepository", () => {
	let repository: SecurityLogRepository;
	let mockDatabase: {
		securityLog: {
			create: jest.Mock;
			findMany: jest.Mock;
			deleteMany: jest.Mock;
			groupBy: jest.Mock;
		};
	};

	const mockSecurityLog: SecurityLog = {
		id: 1,
		userId: "user-123",
		event: "LOGIN_SUCCESS",
		ipAddress: "192.168.1.1",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		metadata: { browser: "Chrome", os: "macOS" },
		createdAt: new Date("2025-01-15T10:00:00Z"),
	};

	beforeEach(async () => {
		mockDatabase = {
			securityLog: {
				create: jest.fn(),
				findMany: jest.fn(),
				deleteMany: jest.fn(),
				groupBy: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecurityLogRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<SecurityLogRepository>(SecurityLogRepository);
	});

	describe("create", () => {
		const createData = {
			userId: "user-123",
			event: "LOGIN_SUCCESS" as const,
			ipAddress: "192.168.1.1",
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
			metadata: { browser: "Chrome", os: "macOS" },
		};

		it("보안 로그를 생성한다", async () => {
			// Given
			mockDatabase.securityLog.create.mockResolvedValue(mockSecurityLog);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockSecurityLog);
			expect(mockDatabase.securityLog.create).toHaveBeenCalledWith({
				data: {
					userId: createData.userId,
					event: createData.event,
					ipAddress: createData.ipAddress,
					userAgent: createData.userAgent,
					metadata: createData.metadata,
				},
			});
		});

		it("userId 없이 보안 로그를 생성한다", async () => {
			// Given
			const anonymousLogData = {
				event: "LOGIN_FAILURE" as const,
				ipAddress: "192.168.1.1",
				userAgent: "Mozilla/5.0",
			};
			const anonymousLog: SecurityLog = {
				...mockSecurityLog,
				userId: null,
				event: "LOGIN_FAILURE",
				metadata: null,
			};
			mockDatabase.securityLog.create.mockResolvedValue(anonymousLog);

			// When
			const result = await repository.create(anonymousLogData);

			// Then
			expect(result).toEqual(anonymousLog);
			expect(mockDatabase.securityLog.create).toHaveBeenCalledWith({
				data: {
					userId: undefined,
					event: anonymousLogData.event,
					ipAddress: anonymousLogData.ipAddress,
					userAgent: anonymousLogData.userAgent,
					metadata: undefined,
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.securityLog.create.mockResolvedValue(mockSecurityLog);

			// When
			const result = await repository.create(createData, asTxClient(mockTx));

			// Then
			expect(result).toEqual(mockSecurityLog);
			expect(mockTx.securityLog.create).toHaveBeenCalled();
			expect(mockDatabase.securityLog.create).not.toHaveBeenCalled();
		});
	});

	describe("findByUserId", () => {
		const securityLogs: SecurityLog[] = [
			mockSecurityLog,
			{
				...mockSecurityLog,
				id: 2,
				event: "PASSWORD_CHANGED",
				createdAt: new Date("2025-01-14T10:00:00Z"),
			},
		];

		it("사용자의 보안 로그를 최신순으로 조회한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue(securityLogs);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(securityLogs);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				orderBy: { createdAt: "desc" },
				take: 50,
			});
		});

		it("limit 옵션을 적용하여 조회한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([mockSecurityLog]);

			// When
			const result = await repository.findByUserId("user-123", { limit: 10 });

			// Then
			expect(result).toHaveLength(1);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				orderBy: { createdAt: "desc" },
				take: 10,
			});
		});

		it("특정 이벤트 타입만 필터링하여 조회한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([mockSecurityLog]);

			// When
			const result = await repository.findByUserId("user-123", {
				events: ["LOGIN_SUCCESS", "LOGIN_FAILURE"],
			});

			// Then
			expect(result).toHaveLength(1);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					event: { in: ["LOGIN_SUCCESS", "LOGIN_FAILURE"] },
				},
				orderBy: { createdAt: "desc" },
				take: 50,
			});
		});
	});

	describe("findRecentByEvent", () => {
		const since = new Date("2025-01-01T00:00:00Z");

		it("특정 이벤트 타입의 최근 로그를 조회한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([mockSecurityLog]);

			// When
			const result = await repository.findRecentByEvent("LOGIN_SUCCESS", since);

			// Then
			expect(result).toHaveLength(1);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					event: "LOGIN_SUCCESS",
					createdAt: { gte: since },
				},
				orderBy: { createdAt: "desc" },
				take: 100,
			});
		});

		it("userId 옵션으로 필터링한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([mockSecurityLog]);

			// When
			const result = await repository.findRecentByEvent(
				"LOGIN_SUCCESS",
				since,
				{
					userId: "user-123",
				},
			);

			// Then
			expect(result).toHaveLength(1);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					event: "LOGIN_SUCCESS",
					createdAt: { gte: since },
					userId: "user-123",
				},
				orderBy: { createdAt: "desc" },
				take: 100,
			});
		});

		it("ipAddress 옵션으로 필터링한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([mockSecurityLog]);

			// When
			const result = await repository.findRecentByEvent(
				"LOGIN_FAILURE",
				since,
				{
					ipAddress: "192.168.1.1",
				},
			);

			// Then
			expect(result).toHaveLength(1);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					event: "LOGIN_FAILURE",
					createdAt: { gte: since },
					ipAddress: "192.168.1.1",
				},
				orderBy: { createdAt: "desc" },
				take: 100,
			});
		});

		it("limit 옵션을 적용한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([]);

			// When
			await repository.findRecentByEvent("LOGIN_SUCCESS", since, { limit: 10 });

			// Then
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					event: "LOGIN_SUCCESS",
					createdAt: { gte: since },
				},
				orderBy: { createdAt: "desc" },
				take: 10,
			});
		});
	});

	describe("findSuspiciousActivityByIp", () => {
		const since = new Date("2025-01-01T00:00:00Z");
		const suspiciousLogs: SecurityLog[] = [
			{ ...mockSecurityLog, event: "LOGIN_FAILURE" },
			{ ...mockSecurityLog, id: 2, event: "SUSPICIOUS_ACTIVITY" },
		];

		it("IP 주소의 의심스러운 활동을 조회한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue(suspiciousLogs);

			// When
			const result = await repository.findSuspiciousActivityByIp(
				"192.168.1.1",
				since,
			);

			// Then
			expect(result).toEqual(suspiciousLogs);
			expect(mockDatabase.securityLog.findMany).toHaveBeenCalledWith({
				where: {
					ipAddress: "192.168.1.1",
					createdAt: { gte: since },
					event: {
						in: [
							"LOGIN_FAILURE",
							"SUSPICIOUS_ACTIVITY",
							"TOKEN_REVOKED",
							"SESSION_REVOKED_ALL",
						],
					},
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("의심스러운 활동이 없으면 빈 배열을 반환한다", async () => {
			// Given
			mockDatabase.securityLog.findMany.mockResolvedValue([]);

			// When
			const result = await repository.findSuspiciousActivityByIp(
				"10.0.0.1",
				since,
			);

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("deleteOld", () => {
		it("기본 90일 이전 로그를 삭제한다", async () => {
			// Given
			mockDatabase.securityLog.deleteMany.mockResolvedValue({ count: 100 });

			// When
			const result = await repository.deleteOld();

			// Then
			expect(result).toBe(100);
			expect(mockDatabase.securityLog.deleteMany).toHaveBeenCalledWith({
				where: {
					createdAt: { lt: expect.any(Date) },
				},
			});
		});

		it("지정된 보관 기간으로 삭제한다", async () => {
			// Given
			mockDatabase.securityLog.deleteMany.mockResolvedValue({ count: 50 });

			// When
			const result = await repository.deleteOld(30);

			// Then
			expect(result).toBe(50);
			expect(mockDatabase.securityLog.deleteMany).toHaveBeenCalledWith({
				where: {
					createdAt: { lt: expect.any(Date) },
				},
			});
		});

		it("삭제할 로그가 없으면 0을 반환한다", async () => {
			// Given
			mockDatabase.securityLog.deleteMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.deleteOld();

			// Then
			expect(result).toBe(0);
		});
	});

	describe("countByEvent", () => {
		const since = new Date("2025-01-01T00:00:00Z");
		const until = new Date("2025-01-31T23:59:59Z");

		it("기간 내 이벤트별 카운트를 반환한다", async () => {
			// Given
			mockDatabase.securityLog.groupBy.mockResolvedValue([
				{ event: "LOGIN_SUCCESS", _count: { event: 100 } },
				{ event: "LOGIN_FAILURE", _count: { event: 20 } },
				{ event: "PASSWORD_CHANGED", _count: { event: 5 } },
			]);

			// When
			const result = await repository.countByEvent(since, until);

			// Then
			expect(result).toEqual([
				{ event: "LOGIN_SUCCESS", count: 100 },
				{ event: "LOGIN_FAILURE", count: 20 },
				{ event: "PASSWORD_CHANGED", count: 5 },
			]);
			expect(mockDatabase.securityLog.groupBy).toHaveBeenCalledWith({
				by: ["event"],
				where: {
					createdAt: {
						gte: since,
						lte: until,
					},
				},
				_count: { event: true },
			});
		});

		it("until 없이 since부터 현재까지 카운트한다", async () => {
			// Given
			mockDatabase.securityLog.groupBy.mockResolvedValue([
				{ event: "LOGIN_SUCCESS", _count: { event: 50 } },
			]);

			// When
			const result = await repository.countByEvent(since);

			// Then
			expect(result).toEqual([{ event: "LOGIN_SUCCESS", count: 50 }]);
			expect(mockDatabase.securityLog.groupBy).toHaveBeenCalledWith({
				by: ["event"],
				where: {
					createdAt: {
						gte: since,
					},
				},
				_count: { event: true },
			});
		});

		it("이벤트가 없으면 빈 배열을 반환한다", async () => {
			// Given
			mockDatabase.securityLog.groupBy.mockResolvedValue([]);

			// When
			const result = await repository.countByEvent(since);

			// Then
			expect(result).toEqual([]);
		});
	});
});
