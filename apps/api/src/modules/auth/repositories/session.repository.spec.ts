import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SessionBuilder } from "@test/builders";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";

import { SessionRepository } from "./session.repository";

describe("SessionRepository", () => {
	let repository: SessionRepository;
	let db: Mocked<DatabaseService>;

	// Builder로 기본 테스트 세션 생성
	const mockSession = SessionBuilder.create("user-123")
		.withId("session-123")
		.withRefreshTokenHash("hashed-refresh-token")
		.withTokenFamily("family-123")
		.withTokenVersion(1)
		.withDeviceInfo("Mozilla/5.0", "127.0.0.1")
		.withExpiresAt(new Date("2024-12-31"))
		.build();

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } =
			await TestBed.solitary(SessionRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	describe("create", () => {
		it("새 세션을 생성한다", async () => {
			// Given - 세션 생성 데이터 준비
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
			db.session.create.mockResolvedValue(mockSession);

			// When - 세션 생성 실행
			const result = await repository.create(createData);

			// Then - 생성된 세션 검증
			expect(result).toEqual(mockSession);
			expect(db.session.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: createData.userId,
					tokenFamily: createData.tokenFamily,
					tokenVersion: createData.tokenVersion,
					ipAddress: createData.ipAddress,
				}),
			});
		});

		it("refreshTokenHash가 없으면 임시 해시를 생성한다", async () => {
			// Given - refreshTokenHash 없이 세션 생성 데이터 준비
			const createData = {
				userId: "user-123",
				tokenFamily: "family-123",
				tokenVersion: 1,
				deviceFingerprint: "device-fp",
				userAgent: "Mozilla/5.0",
				ipAddress: "127.0.0.1",
				expiresAt: new Date("2024-12-31"),
			};
			db.session.create.mockResolvedValue(mockSession);

			// When - 세션 생성 실행
			await repository.create(createData);

			// Then - 임시 해시가 생성되었는지 검증
			expect(db.session.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					refreshTokenHash: expect.stringContaining("pending_"),
				}),
			});
		});

		it("트랜잭션 내에서 세션을 생성한다", async () => {
			// Given - 트랜잭션 클라이언트와 세션 생성 데이터 준비
			const createData = {
				userId: "user-123",
				tokenFamily: "family-123",
				tokenVersion: 1,
				deviceFingerprint: "device-fp",
				userAgent: "Mozilla/5.0",
				ipAddress: "127.0.0.1",
				expiresAt: new Date("2024-12-31"),
			};
			const mockTx = createMockTxClient();
			mockTx.session.create.mockResolvedValue(mockSession);

			// When - 트랜잭션 내에서 세션 생성 실행
			await repository.create(createData, asTxClient(mockTx));

			// Then - 트랜잭션 클라이언트를 통해 생성되었는지 검증
			expect(mockTx.session.create).toHaveBeenCalled();
		});
	});

	describe("updateRefreshTokenHash", () => {
		it("리프레시 토큰 해시를 업데이트한다", async () => {
			// Given - 새로운 해시값 준비
			const newHash = "new-hashed-token";
			const updatedSession = SessionBuilder.create("user-123")
				.withId("session-123")
				.withRefreshTokenHash(newHash)
				.build();
			db.session.update.mockResolvedValue(updatedSession);

			// When - 리프레시 토큰 해시 업데이트 실행
			const result = await repository.updateRefreshTokenHash(
				"session-123",
				newHash,
			);

			// Then - 업데이트된 해시값 검증
			expect(result.refreshTokenHash).toBe(newHash);
			expect(db.session.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: { refreshTokenHash: newHash },
			});
		});
	});

	describe("findById", () => {
		it("ID로 세션을 찾아 반환한다", async () => {
			// Given - 세션 조회 Mock 설정
			db.session.findUnique.mockResolvedValue(mockSession);

			// When - ID로 세션 조회 실행
			const result = await repository.findById("session-123");

			// Then - 조회된 세션 검증
			expect(result).toEqual(mockSession);
			expect(db.session.findUnique).toHaveBeenCalledWith({
				where: { id: "session-123" },
			});
		});

		it("세션이 없으면 null을 반환한다", async () => {
			// Given - 존재하지 않는 세션 Mock 설정
			db.session.findUnique.mockResolvedValue(null);

			// When - 존재하지 않는 세션 조회 실행
			const result = await repository.findById("nonexistent");

			// Then - null 반환 검증
			expect(result).toBeNull();
		});
	});

	describe("findByRefreshTokenHash", () => {
		it("리프레시 토큰 해시로 세션을 찾는다", async () => {
			// Given - 세션 조회 Mock 설정
			db.session.findUnique.mockResolvedValue(mockSession);

			// When - 리프레시 토큰 해시로 세션 조회 실행
			const result = await repository.findByRefreshTokenHash("hashed-token");

			// Then - 조회된 세션 검증
			expect(result).toEqual(mockSession);
			expect(db.session.findUnique).toHaveBeenCalledWith({
				where: { refreshTokenHash: "hashed-token" },
			});
		});
	});

	describe("findByTokenFamily", () => {
		it("토큰 패밀리로 활성 세션을 찾는다", async () => {
			// Given - 활성 세션 조회 Mock 설정
			db.session.findFirst.mockResolvedValue(mockSession);

			// When - 토큰 패밀리로 세션 조회 실행
			const result = await repository.findByTokenFamily("family-123");

			// Then - 조회된 활성 세션 검증
			expect(result).toEqual(mockSession);
			expect(db.session.findFirst).toHaveBeenCalledWith({
				where: {
					tokenFamily: "family-123",
					revokedAt: null,
				},
			});
		});
	});

	describe("findActiveByUserId", () => {
		it("사용자의 활성 세션 목록을 반환한다", async () => {
			// Given - 여러 활성 세션 Mock 설정
			const session2 = SessionBuilder.create("user-123")
				.withId("session-2")
				.build();
			const activeSessions = [mockSession, session2];
			db.session.findMany.mockResolvedValue(activeSessions);

			// When - 사용자 ID로 활성 세션 목록 조회 실행
			const result = await repository.findActiveByUserId("user-123");

			// Then - 활성 세션 목록 검증
			expect(result).toHaveLength(2);
			expect(db.session.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					revokedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { lastUsedAt: "desc" },
			});
		});

		it("활성 세션이 없으면 빈 배열을 반환한다", async () => {
			// Given - 빈 세션 목록 Mock 설정
			db.session.findMany.mockResolvedValue([]);

			// When - 활성 세션이 없는 사용자 조회 실행
			const result = await repository.findActiveByUserId("user-123");

			// Then - 빈 배열 반환 검증
			expect(result).toEqual([]);
		});
	});

	describe("rotateToken", () => {
		it("토큰 로테이션을 수행한다", async () => {
			// Given - 토큰 로테이션 데이터 준비
			const rotatedSession = SessionBuilder.create("user-123")
				.withId("session-123")
				.withRefreshTokenHash("new-hash")
				.withTokenVersion(2)
				.withPreviousTokenHash("old-hash")
				.build();
			db.session.updateMany.mockResolvedValue({ count: 1 });
			db.session.findUnique.mockResolvedValue(rotatedSession);

			// When - 토큰 로테이션 실행
			const result = await repository.rotateToken("session-123", {
				refreshTokenHash: "new-hash",
				tokenVersion: 2,
				previousTokenHash: "old-hash",
				expectedTokenVersion: 1,
			});

			// Then - 로테이션된 세션 검증
			expect(result).toEqual(rotatedSession);
			expect(db.session.updateMany).toHaveBeenCalledWith({
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
			// Given - 버전 불일치 상황 Mock 설정 (업데이트 count: 0)
			db.session.updateMany.mockResolvedValue({ count: 0 });

			// When - 버전 불일치 상태로 토큰 로테이션 실행
			const result = await repository.rotateToken("session-123", {
				refreshTokenHash: "new-hash",
				tokenVersion: 3,
				previousTokenHash: "old-hash",
				expectedTokenVersion: 2, // 실제 버전과 불일치
			});

			// Then - null 반환 검증
			expect(result).toBeNull();
		});
	});

	describe("updateLastUsedAt", () => {
		it("마지막 사용 시간을 업데이트한다", async () => {
			// Given - 업데이트 Mock 설정
			const updatedSession = SessionBuilder.create("user-123")
				.withId("session-123")
				.withLastUsedAt(new Date())
				.build();
			db.session.update.mockResolvedValue(updatedSession);

			// When - 마지막 사용 시간 업데이트 실행
			await repository.updateLastUsedAt("session-123");

			// Then - 업데이트 호출 검증
			expect(db.session.update).toHaveBeenCalledWith({
				where: { id: "session-123" },
				data: { lastUsedAt: expect.any(Date) },
			});
		});
	});

	describe("revoke", () => {
		it("세션을 폐기한다", async () => {
			// Given - 폐기된 세션 Mock 설정
			const revokedSession = SessionBuilder.create("user-123")
				.withId("session-123")
				.revoked("user_logout")
				.build();
			db.session.update.mockResolvedValue(revokedSession);

			// When - 세션 폐기 실행
			const result = await repository.revoke("session-123", "user_logout");

			// Then - 폐기된 세션 검증
			expect(result.revokedAt).toBeDefined();
			expect(result.revokedReason).toBe("user_logout");
			expect(db.session.update).toHaveBeenCalledWith({
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
			// Given - 여러 세션 폐기 Mock 설정
			db.session.updateMany.mockResolvedValue({ count: 3 });

			// When - 토큰 패밀리 전체 폐기 실행
			const result = await repository.revokeByTokenFamily(
				"family-123",
				"token_reuse_detected",
			);

			// Then - 폐기된 세션 수 검증
			expect(result).toBe(3);
			expect(db.session.updateMany).toHaveBeenCalledWith({
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
			// Given - 사용자의 모든 세션 폐기 Mock 설정
			db.session.updateMany.mockResolvedValue({ count: 5 });

			// When - 사용자의 모든 세션 폐기 실행
			const result = await repository.revokeAllByUserId(
				"user-123",
				"password_changed",
			);

			// Then - 폐기된 세션 수 검증
			expect(result).toBe(5);
			expect(db.session.updateMany).toHaveBeenCalledWith({
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
			// Given - 특정 세션 제외 폐기 Mock 설정
			db.session.updateMany.mockResolvedValue({ count: 4 });

			// When - 현재 세션을 제외하고 나머지 폐기 실행
			const result = await repository.revokeAllByUserId(
				"user-123",
				"logout_all",
				"current-session-id",
			);

			// Then - 제외된 세션을 제외한 폐기 검증
			expect(result).toBe(4);
			expect(db.session.updateMany).toHaveBeenCalledWith({
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
			// Given - 만료/폐기된 세션 삭제 Mock 설정
			db.session.deleteMany.mockResolvedValue({ count: 10 });

			// When - 만료된 세션 삭제 실행
			const result = await repository.deleteExpired();

			// Then - 삭제된 세션 수 검증
			expect(result).toBe(10);
			expect(db.session.deleteMany).toHaveBeenCalledWith({
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
			// Given - 이전 토큰 해시로 세션 조회 Mock 설정
			db.session.findFirst.mockResolvedValue(mockSession);

			// When - 이전 토큰 해시로 세션 조회 실행
			const result = await repository.findByPreviousTokenHash("previous-hash");

			// Then - 조회된 세션 검증
			expect(result).toEqual(mockSession);
			expect(db.session.findFirst).toHaveBeenCalledWith({
				where: { previousTokenHash: "previous-hash" },
			});
		});

		it("해당 토큰 해시가 없으면 null을 반환한다", async () => {
			// Given - 존재하지 않는 토큰 해시 Mock 설정
			db.session.findFirst.mockResolvedValue(null);

			// When - 존재하지 않는 토큰 해시로 조회 실행
			const result =
				await repository.findByPreviousTokenHash("nonexistent-hash");

			// Then - null 반환 검증
			expect(result).toBeNull();
		});
	});
});
