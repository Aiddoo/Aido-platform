import { Test, type TestingModule } from "@nestjs/testing";

import { DatabaseService } from "@/database";
import type { Session } from "@/generated/prisma/client";

import { SessionRepository } from "./session.repository";

describe("SessionRepository", () => {
	let repository: SessionRepository;
	let mockDatabase: {
		session: {
			create: jest.Mock;
			findUnique: jest.Mock;
			findFirst: jest.Mock;
			findMany: jest.Mock;
			update: jest.Mock;
			updateMany: jest.Mock;
			deleteMany: jest.Mock;
		};
	};

	const mockSession: Session = {
		id: "session-123",
		userId: "user-123",
		refreshTokenHash: "hashed-refresh-token",
		tokenFamily: "family-123",
		tokenVersion: 1,
		previousTokenHash: null,
		deviceFingerprint: "device-fp-123",
		userAgent: "Mozilla/5.0",
		ipAddress: "127.0.0.1",
		expiresAt: new Date("2024-12-31"),
		lastUsedAt: new Date("2024-01-01"),
		revokedAt: null,
		revokedReason: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	};

	beforeEach(async () => {
		mockDatabase = {
			session: {
				create: jest.fn(),
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				findMany: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
				deleteMany: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SessionRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<SessionRepository>(SessionRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("create", () => {
		it("새 세션을 생성한다", async () => {
			// Given
			const createData = {
				userId: "user-123",
				refreshTokenHash: "hashed-token",
				tokenFamily: "family-123",
				tokenVersion: 1,
				deviceFingerprint: "device-fp",
				userAgent: "Mozilla/5.0",
				ipAddress: "127.0.0.1",
				expiresAt: new Date("2024-12-31"),
			};
			mockDatabase.session.create.mockResolvedValue(mockSession);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockSession);
			expect(mockDatabase.session.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: createData.userId,
					tokenFamily: createData.tokenFamily,
					tokenVersion: createData.tokenVersion,
					ipAddress: createData.ipAddress,
				}),
			});
		});

		it("refreshTokenHash가 없으면 임시 해시를 생성한다", async () => {
			// Given
			const createData = {
				userId: "user-123",
				tokenFamily: "family-123",
				tokenVersion: 1,
				deviceFingerprint: "device-fp",
				userAgent: "Mozilla/5.0",
				ipAddress: "127.0.0.1",
				expiresAt: new Date("2024-12-31"),
			};
			mockDatabase.session.create.mockResolvedValue(mockSession);

			// When
			await repository.create(createData);

			// Then
			expect(mockDatabase.session.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					refreshTokenHash: expect.stringContaining("pending_"),
				}),
			});
		});

		it("트랜잭션 내에서 세션을 생성한다", async () => {
			// Given
			const createData = {
				userId: "user-123",
				tokenFamily: "family-123",
				tokenVersion: 1,
				deviceFingerprint: "device-fp",
				userAgent: "Mozilla/5.0",
				ipAddress: "127.0.0.1",
				expiresAt: new Date("2024-12-31"),
			};
			const mockTx = {
				session: {
					create: jest.fn().mockResolvedValue(mockSession),
				},
			};

			// When
			await repository.create(
				createData,
				mockTx as unknown as Parameters<typeof repository.create>[1],
			);

			// Then
			expect(mockTx.session.create).toHaveBeenCalled();
		});
	});

	describe("updateRefreshTokenHash", () => {
		it("리프레시 토큰 해시를 업데이트한다", async () => {
			// Given
			const newHash = "new-hashed-token";
			mockDatabase.session.update.mockResolvedValue({
				...mockSession,
				refreshTokenHash: newHash,
			});

			// When
			const result = await repository.updateRefreshTokenHash(
				"session-123",
				newHash,
			);

			// Then
			expect(result.refreshTokenHash).toBe(newHash);
			expect(mockDatabase.session.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: { refreshTokenHash: newHash },
			});
		});
	});

	describe("findById", () => {
		it("ID로 세션을 찾아 반환한다", async () => {
			// Given
			mockDatabase.session.findUnique.mockResolvedValue(mockSession);

			// When
			const result = await repository.findById("session-123");

			// Then
			expect(result).toEqual(mockSession);
			expect(mockDatabase.session.findUnique).toHaveBeenCalledWith({
				where: { id: "session-123" },
			});
		});

		it("세션이 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.session.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findById("nonexistent");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findByRefreshTokenHash", () => {
		it("리프레시 토큰 해시로 세션을 찾는다", async () => {
			// Given
			mockDatabase.session.findUnique.mockResolvedValue(mockSession);

			// When
			const result = await repository.findByRefreshTokenHash("hashed-token");

			// Then
			expect(result).toEqual(mockSession);
			expect(mockDatabase.session.findUnique).toHaveBeenCalledWith({
				where: { refreshTokenHash: "hashed-token" },
			});
		});
	});

	describe("findByTokenFamily", () => {
		it("토큰 패밀리로 활성 세션을 찾는다", async () => {
			// Given
			mockDatabase.session.findFirst.mockResolvedValue(mockSession);

			// When
			const result = await repository.findByTokenFamily("family-123");

			// Then
			expect(result).toEqual(mockSession);
			expect(mockDatabase.session.findFirst).toHaveBeenCalledWith({
				where: {
					tokenFamily: "family-123",
					revokedAt: null,
				},
			});
		});
	});

	describe("findActiveByUserId", () => {
		it("사용자의 활성 세션 목록을 반환한다", async () => {
			// Given
			const activeSessions = [mockSession, { ...mockSession, id: "session-2" }];
			mockDatabase.session.findMany.mockResolvedValue(activeSessions);

			// When
			const result = await repository.findActiveByUserId("user-123");

			// Then
			expect(result).toHaveLength(2);
			expect(mockDatabase.session.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					revokedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { lastUsedAt: "desc" },
			});
		});

		it("활성 세션이 없으면 빈 배열을 반환한다", async () => {
			// Given
			mockDatabase.session.findMany.mockResolvedValue([]);

			// When
			const result = await repository.findActiveByUserId("user-123");

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("rotateToken", () => {
		it("토큰 로테이션을 수행한다", async () => {
			// Given
			const rotatedSession = {
				...mockSession,
				refreshTokenHash: "new-hash",
				tokenVersion: 2,
				previousTokenHash: "old-hash",
			};
			mockDatabase.session.updateMany.mockResolvedValue({ count: 1 });
			mockDatabase.session.findUnique.mockResolvedValue(rotatedSession);

			// When
			const result = await repository.rotateToken("session-123", {
				refreshTokenHash: "new-hash",
				tokenVersion: 2,
				previousTokenHash: "old-hash",
				expectedTokenVersion: 1,
			});

			// Then
			expect(result).toEqual(rotatedSession);
			expect(mockDatabase.session.updateMany).toHaveBeenCalledWith({
				where: {
					id: "session-123",
					tokenVersion: 1,
					revokedAt: null,
				},
				data: {
					refreshTokenHash: "new-hash",
					tokenVersion: 2,
					previousTokenHash: "old-hash",
					lastUsedAt: expect.any(Date),
				},
			});
		});

		it("버전 불일치 시 null을 반환한다", async () => {
			// Given
			mockDatabase.session.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.rotateToken("session-123", {
				refreshTokenHash: "new-hash",
				tokenVersion: 3,
				previousTokenHash: "old-hash",
				expectedTokenVersion: 2, // 실제 버전과 불일치
			});

			// Then
			expect(result).toBeNull();
		});
	});

	describe("updateLastUsedAt", () => {
		it("마지막 사용 시간을 업데이트한다", async () => {
			// Given
			mockDatabase.session.update.mockResolvedValue({
				...mockSession,
				lastUsedAt: new Date(),
			});

			// When
			await repository.updateLastUsedAt("session-123");

			// Then
			expect(mockDatabase.session.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: { lastUsedAt: expect.any(Date) },
			});
		});
	});

	describe("revoke", () => {
		it("세션을 폐기한다", async () => {
			// Given
			const revokedSession = {
				...mockSession,
				revokedAt: new Date(),
				revokedReason: "user_logout",
			};
			mockDatabase.session.update.mockResolvedValue(revokedSession);

			// When
			const result = await repository.revoke("session-123", "user_logout");

			// Then
			expect(result.revokedAt).toBeDefined();
			expect(result.revokedReason).toBe("user_logout");
			expect(mockDatabase.session.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: {
					revokedAt: expect.any(Date),
					revokedReason: "user_logout",
				},
			});
		});
	});

	describe("revokeByTokenFamily", () => {
		it("토큰 패밀리 전체를 폐기한다", async () => {
			// Given
			mockDatabase.session.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.revokeByTokenFamily(
				"family-123",
				"token_reuse_detected",
			);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.session.updateMany).toHaveBeenCalledWith({
				where: {
					tokenFamily: "family-123",
					revokedAt: null,
				},
				data: {
					revokedAt: expect.any(Date),
					revokedReason: "token_reuse_detected",
				},
			});
		});
	});

	describe("revokeAllByUserId", () => {
		it("사용자의 모든 세션을 폐기한다", async () => {
			// Given
			mockDatabase.session.updateMany.mockResolvedValue({ count: 5 });

			// When
			const result = await repository.revokeAllByUserId(
				"user-123",
				"password_changed",
			);

			// Then
			expect(result).toBe(5);
			expect(mockDatabase.session.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					revokedAt: null,
				},
				data: {
					revokedAt: expect.any(Date),
					revokedReason: "password_changed",
				},
			});
		});

		it("특정 세션을 제외하고 폐기한다", async () => {
			// Given
			mockDatabase.session.updateMany.mockResolvedValue({ count: 4 });

			// When
			const result = await repository.revokeAllByUserId(
				"user-123",
				"logout_all",
				"current-session-id",
			);

			// Then
			expect(result).toBe(4);
			expect(mockDatabase.session.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					revokedAt: null,
					id: { not: "current-session-id" },
				},
				data: {
					revokedAt: expect.any(Date),
					revokedReason: "logout_all",
				},
			});
		});
	});

	describe("deleteExpired", () => {
		it("만료되거나 폐기된 세션을 삭제한다", async () => {
			// Given
			mockDatabase.session.deleteMany.mockResolvedValue({ count: 10 });

			// When
			const result = await repository.deleteExpired();

			// Then
			expect(result).toBe(10);
			expect(mockDatabase.session.deleteMany).toHaveBeenCalledWith({
				where: {
					OR: [
						{ expiresAt: { lt: expect.any(Date) } },
						{ revokedAt: { not: null } },
					],
				},
			});
		});
	});

	describe("findByPreviousTokenHash", () => {
		it("이전 토큰 해시로 세션을 찾는다 (재사용 감지용)", async () => {
			// Given
			mockDatabase.session.findFirst.mockResolvedValue(mockSession);

			// When
			const result = await repository.findByPreviousTokenHash("previous-hash");

			// Then
			expect(result).toEqual(mockSession);
			expect(mockDatabase.session.findFirst).toHaveBeenCalledWith({
				where: { previousTokenHash: "previous-hash" },
			});
		});

		it("해당 토큰 해시가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.session.findFirst.mockResolvedValue(null);

			// When
			const result =
				await repository.findByPreviousTokenHash("nonexistent-hash");

			// Then
			expect(result).toBeNull();
		});
	});
});
