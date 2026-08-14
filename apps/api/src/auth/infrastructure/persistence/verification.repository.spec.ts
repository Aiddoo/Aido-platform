/**
 * VerificationRepository 단위 테스트
 *
 * @description
 * 인증 토큰 저장소의 CRUD, 원자적 사용 처리, 무효화 메서드를 검증한다.
 * 트랜잭션 지원, 시도 횟수 관리, 만료 삭제를 확인한다.
 *
 * 이 저장소는 두 개의 클라이언트를 사용한다.
 * - `txHost.tx`(활성 트랜잭션): 대부분의 메서드
 * - `database`(베이스 클라이언트): `incrementAttempts`, `deleteExpired`
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test verification.repository.spec.ts
 * ```
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { VerificationBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";

import { type Verification, VerificationType } from "@/generated/prisma/client";
import { DatabaseService } from "@/shared/infrastructure/database";

import { VerificationRepository } from "./verification.repository";

describe("VerificationRepository — 인증 코드 리포지토리", () => {
	let repository: VerificationRepository;
	let db: MockPrismaClient;
	let baseDb: MockPrismaClient;

	const mockVerification = VerificationBuilder.create("user-123", VerificationType.EMAIL_VERIFY)
		.withId(1)
		.withToken("hashed-token-123")
		.withExpiresAt(new Date("2025-12-31T23:59:59Z"))
		.withCreatedAt(new Date("2025-01-01T00:00:00Z"))
		.build();

	beforeEach(async () => {
		db = createMockPrisma();
		baseDb = createMockPrisma();

		const { unit } = await TestBed.solitary(VerificationRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.mock(DatabaseService)
			.impl(() => baseDb)
			.compile();

		repository = unit;
	});

	describe("create", () => {
		const createData = {
			userId: "user-123",
			type: VerificationType.EMAIL_VERIFY,
			token: "hashed-token-123",
			expiresAt: new Date("2025-12-31T23:59:59Z"),
		};

		it("새 인증 토큰을 생성한다", async () => {
			// Given
			db.verification.create.mockResolvedValue(mockVerification);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.create).toHaveBeenCalledWith({
				data: {
					userId: createData.userId,
					type: createData.type,
					token: createData.token,
					expiresAt: createData.expiresAt,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 생성한다", async () => {
			// Given
			db.verification.create.mockResolvedValue(mockVerification);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.create).toHaveBeenCalledWith({
				data: {
					userId: createData.userId,
					type: createData.type,
					token: createData.token,
					expiresAt: createData.expiresAt,
				},
			});
		});
	});

	describe("findByToken", () => {
		it("토큰 해시로 인증을 찾는다", async () => {
			// Given
			db.verification.findUnique.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findByToken("hashed-token-123");

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.findUnique).toHaveBeenCalledWith({
				where: { token: "hashed-token-123" },
			});
		});

		it("존재하지 않으면 null을 반환한다", async () => {
			// Given
			db.verification.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByToken("non-existent-token");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findLatestByUserIdAndType", () => {
		it("사용자의 최신 유효 인증 토큰을 찾는다", async () => {
			// Given
			db.verification.findFirst.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findLatestByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					usedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("유효한 인증이 없으면 null을 반환한다", async () => {
			// Given
			db.verification.findFirst.mockResolvedValue(null);

			// When
			const result = await repository.findLatestByUserIdAndType(
				"user-123",
				VerificationType.PASSWORD_RESET,
			);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findValidByUserIdAndType", () => {
		it("사용자의 유효한 인증을 찾는다", async () => {
			// Given
			db.verification.findFirst.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findValidByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					usedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("활성 트랜잭션 클라이언트로 조회한다", async () => {
			// Given
			db.verification.findFirst.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findValidByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(db.verification.findFirst).toHaveBeenCalled();
		});
	});

	describe("markAsUsed", () => {
		const usedVerification: Verification = {
			...mockVerification,
			usedAt: new Date("2025-01-15T10:00:00Z"),
		};

		it("인증 토큰을 사용됨으로 표시한다", async () => {
			// Given
			db.verification.update.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsed(1);

			// Then
			expect(result).toEqual(usedVerification);
			expect(db.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { usedAt: expect.any(Date) },
			});
		});

		it("활성 트랜잭션 클라이언트로 업데이트한다", async () => {
			// Given
			db.verification.update.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsed(1);

			// Then
			expect(result).toEqual(usedVerification);
			expect(db.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { usedAt: expect.any(Date) },
			});
		});
	});

	describe("incrementAttempts", () => {
		const incrementedVerification: Verification = {
			...mockVerification,
			attempts: 1,
		};

		it("시도 횟수를 1 증가시킨다 (베이스 클라이언트 사용)", async () => {
			// Given
			baseDb.verification.update.mockResolvedValue(incrementedVerification);

			// When
			const result = await repository.incrementAttempts(1);

			// Then
			expect(result).toEqual(incrementedVerification);
			expect(baseDb.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { attempts: { increment: 1 } },
			});
		});

		it("활성 트랜잭션을 우회해 베이스 클라이언트로 증가시킨다", async () => {
			// Given
			baseDb.verification.update.mockResolvedValue(incrementedVerification);

			// When
			const result = await repository.incrementAttempts(1);

			// Then
			expect(result).toEqual(incrementedVerification);
			expect(baseDb.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { attempts: { increment: 1 } },
			});
			expect(db.verification.update).not.toHaveBeenCalled();
		});
	});

	describe("markAsUsedAtomic", () => {
		const usedVerification: Verification = {
			...mockVerification,
			usedAt: new Date("2025-01-15T10:00:00Z"),
		};

		it("조건을 충족하면 원자적으로 사용됨 표시를 한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 1 });
			db.verification.findUnique.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsedAtomic(
				"hashed-token-123",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
			);

			// Then
			expect(result).toEqual(usedVerification);
			expect(db.verification.updateMany).toHaveBeenCalledWith({
				where: {
					token: "hashed-token-123",
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					usedAt: null,
					expiresAt: { gt: expect.any(Date) },
					attempts: { lt: 5 },
				},
				data: { usedAt: expect.any(Date) },
			});
			expect(db.verification.findUnique).toHaveBeenCalledWith({
				where: { token: "hashed-token-123" },
			});
		});

		it("조건을 충족하지 않으면 null을 반환한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.markAsUsedAtomic(
				"invalid-token",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
			);

			// Then
			expect(result).toBeNull();
			expect(db.verification.findUnique).not.toHaveBeenCalled();
		});

		it("활성 트랜잭션 클라이언트로 처리한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 1 });
			db.verification.findUnique.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsedAtomic(
				"hashed-token-123",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
			);

			// Then
			expect(result).toEqual(usedVerification);
			expect(db.verification.updateMany).toHaveBeenCalled();
			expect(db.verification.findUnique).toHaveBeenCalled();
		});
	});

	describe("invalidateAllByUserIdAndType", () => {
		it("사용자의 특정 타입 미사용 인증을 모두 무효화한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toBe(3);
			expect(db.verification.updateMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					usedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				data: { expiresAt: expect.any(Date) },
			});
		});

		it("무효화할 인증이 없으면 0을 반환한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.PASSWORD_RESET,
			);

			// Then
			expect(result).toBe(0);
		});

		it("활성 트랜잭션 클라이언트로 무효화한다", async () => {
			// Given
			db.verification.updateMany.mockResolvedValue({ count: 2 });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toBe(2);
			expect(db.verification.updateMany).toHaveBeenCalled();
		});
	});

	describe("countRecentByUserIdAndType", () => {
		it("특정 기간 내 인증 발송 횟수를 카운트한다", async () => {
			// Given
			db.verification.count.mockResolvedValue(3);
			const since = new Date("2025-01-14T00:00:00Z");

			// When
			const result = await repository.countRecentByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				since,
			);

			// Then
			expect(result).toBe(3);
			expect(db.verification.count).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					createdAt: { gte: since },
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 카운트한다", async () => {
			// Given
			db.verification.count.mockResolvedValue(5);
			const since = new Date("2025-01-14T00:00:00Z");

			// When
			const result = await repository.countRecentByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				since,
			);

			// Then
			expect(result).toBe(5);
			expect(db.verification.count).toHaveBeenCalled();
		});
	});

	describe("deleteExpired", () => {
		it("만료된 인증과 사용된 인증을 삭제한다 (베이스 클라이언트 사용)", async () => {
			// Given
			baseDb.verification.deleteMany.mockResolvedValue({ count: 10 });

			// When
			const result = await repository.deleteExpired();

			// Then
			expect(result).toBe(10);
			expect(baseDb.verification.deleteMany).toHaveBeenCalledWith({
				where: {
					OR: [{ expiresAt: { lt: expect.any(Date) } }, { usedAt: { not: null } }],
				},
			});
		});

		it("삭제할 인증이 없으면 0을 반환한다", async () => {
			// Given
			baseDb.verification.deleteMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.deleteExpired();

			// Then
			expect(result).toBe(0);
		});
	});
});
