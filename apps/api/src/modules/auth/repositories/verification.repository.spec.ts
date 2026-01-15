import { Test, type TestingModule } from "@nestjs/testing";

import { DatabaseService } from "@/database";
import { type Verification, VerificationType } from "@/generated/prisma/client";

import { VerificationRepository } from "./verification.repository";

// 트랜잭션 클라이언트 mock 타입 정의
type MockVerificationClient = {
	verification: {
		create?: jest.Mock;
		findFirst?: jest.Mock;
		findUnique?: jest.Mock;
		update?: jest.Mock;
		updateMany?: jest.Mock;
		count?: jest.Mock;
	};
};

// mock 트랜잭션 클라이언트 생성 헬퍼
function createMockTx(
	overrides: Partial<MockVerificationClient["verification"]> = {},
): MockVerificationClient {
	return {
		verification: overrides,
	};
}

describe("VerificationRepository", () => {
	let repository: VerificationRepository;
	let mockDatabase: {
		verification: {
			create: jest.Mock;
			findUnique: jest.Mock;
			findFirst: jest.Mock;
			update: jest.Mock;
			updateMany: jest.Mock;
			count: jest.Mock;
			deleteMany: jest.Mock;
		};
	};

	const mockVerification: Verification = {
		id: 1,
		userId: "user-123",
		type: VerificationType.EMAIL_VERIFY,
		token: "hashed-token-123",
		expiresAt: new Date("2025-12-31T23:59:59Z"),
		attempts: 0,
		usedAt: null,
		createdAt: new Date("2025-01-01T00:00:00Z"),
	};

	beforeEach(async () => {
		mockDatabase = {
			verification: {
				create: jest.fn(),
				findUnique: jest.fn(),
				findFirst: jest.fn(),
				update: jest.fn(),
				updateMany: jest.fn(),
				count: jest.fn(),
				deleteMany: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VerificationRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<VerificationRepository>(VerificationRepository);
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
			mockDatabase.verification.create.mockResolvedValue(mockVerification);

			// When
			const result = await repository.create(createData);

			// Then
			expect(result).toEqual(mockVerification);
			expect(mockDatabase.verification.create).toHaveBeenCalledWith({
				data: {
					userId: createData.userId,
					type: createData.type,
					token: createData.token,
					expiresAt: createData.expiresAt,
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 생성한다", async () => {
			// Given
			const createMock = jest.fn().mockResolvedValue(mockVerification);
			const mockTx = createMockTx({ create: createMock });

			// When
			const result = await repository.create(
				createData,
				mockTx as unknown as Parameters<typeof repository.create>[1],
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(createMock).toHaveBeenCalledWith({
				data: {
					userId: createData.userId,
					type: createData.type,
					token: createData.token,
					expiresAt: createData.expiresAt,
				},
			});
			expect(mockDatabase.verification.create).not.toHaveBeenCalled();
		});
	});

	describe("findByToken", () => {
		it("토큰 해시로 인증을 찾는다", async () => {
			// Given
			mockDatabase.verification.findUnique.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findByToken("hashed-token-123");

			// Then
			expect(result).toEqual(mockVerification);
			expect(mockDatabase.verification.findUnique).toHaveBeenCalledWith({
				where: { token: "hashed-token-123" },
			});
		});

		it("존재하지 않으면 null을 반환한다", async () => {
			// Given
			mockDatabase.verification.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByToken("non-existent-token");

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findLatestByUserIdAndType", () => {
		it("사용자의 최신 유효 인증 토큰을 찾는다", async () => {
			// Given
			mockDatabase.verification.findFirst.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findLatestByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(mockDatabase.verification.findFirst).toHaveBeenCalledWith({
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
			mockDatabase.verification.findFirst.mockResolvedValue(null);

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
			mockDatabase.verification.findFirst.mockResolvedValue(mockVerification);

			// When
			const result = await repository.findValidByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(mockDatabase.verification.findFirst).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					usedAt: null,
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("트랜잭션 클라이언트를 사용하여 조회한다", async () => {
			// Given
			const findFirstMock = jest.fn().mockResolvedValue(mockVerification);
			const mockTx = createMockTx({ findFirst: findFirstMock });

			// When
			const result = await repository.findValidByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				mockTx as unknown as Parameters<
					typeof repository.findValidByUserIdAndType
				>[2],
			);

			// Then
			expect(result).toEqual(mockVerification);
			expect(findFirstMock).toHaveBeenCalled();
			expect(mockDatabase.verification.findFirst).not.toHaveBeenCalled();
		});
	});

	describe("markAsUsed", () => {
		const usedVerification: Verification = {
			...mockVerification,
			usedAt: new Date("2025-01-15T10:00:00Z"),
		};

		it("인증 토큰을 사용됨으로 표시한다", async () => {
			// Given
			mockDatabase.verification.update.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsed(1);

			// Then
			expect(result).toEqual(usedVerification);
			expect(mockDatabase.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { usedAt: expect.any(Date) },
			});
		});

		it("트랜잭션 클라이언트를 사용하여 업데이트한다", async () => {
			// Given
			const updateMock = jest.fn().mockResolvedValue(usedVerification);
			const mockTx = createMockTx({ update: updateMock });

			// When
			const result = await repository.markAsUsed(
				1,
				mockTx as unknown as Parameters<typeof repository.markAsUsed>[1],
			);

			// Then
			expect(result).toEqual(usedVerification);
			expect(updateMock).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { usedAt: expect.any(Date) },
			});
			expect(mockDatabase.verification.update).not.toHaveBeenCalled();
		});
	});

	describe("incrementAttempts", () => {
		const incrementedVerification: Verification = {
			...mockVerification,
			attempts: 1,
		};

		it("시도 횟수를 1 증가시킨다", async () => {
			// Given
			mockDatabase.verification.update.mockResolvedValue(
				incrementedVerification,
			);

			// When
			const result = await repository.incrementAttempts(1);

			// Then
			expect(result).toEqual(incrementedVerification);
			expect(mockDatabase.verification.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { attempts: { increment: 1 } },
			});
		});

		it("트랜잭션 클라이언트를 사용하여 증가시킨다", async () => {
			// Given
			const updateMock = jest.fn().mockResolvedValue(incrementedVerification);
			const mockTx = createMockTx({ update: updateMock });

			// When
			const result = await repository.incrementAttempts(
				1,
				mockTx as unknown as Parameters<typeof repository.incrementAttempts>[1],
			);

			// Then
			expect(result).toEqual(incrementedVerification);
			expect(updateMock).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { attempts: { increment: 1 } },
			});
			expect(mockDatabase.verification.update).not.toHaveBeenCalled();
		});
	});

	describe("markAsUsedAtomic", () => {
		const usedVerification: Verification = {
			...mockVerification,
			usedAt: new Date("2025-01-15T10:00:00Z"),
		};

		it("조건을 충족하면 원자적으로 사용됨 표시를 한다", async () => {
			// Given
			mockDatabase.verification.updateMany.mockResolvedValue({ count: 1 });
			mockDatabase.verification.findUnique.mockResolvedValue(usedVerification);

			// When
			const result = await repository.markAsUsedAtomic(
				"hashed-token-123",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
			);

			// Then
			expect(result).toEqual(usedVerification);
			expect(mockDatabase.verification.updateMany).toHaveBeenCalledWith({
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
			expect(mockDatabase.verification.findUnique).toHaveBeenCalledWith({
				where: { token: "hashed-token-123" },
			});
		});

		it("조건을 충족하지 않으면 null을 반환한다", async () => {
			// Given
			mockDatabase.verification.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.markAsUsedAtomic(
				"invalid-token",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
			);

			// Then
			expect(result).toBeNull();
			expect(mockDatabase.verification.findUnique).not.toHaveBeenCalled();
		});

		it("트랜잭션 클라이언트를 사용하여 처리한다", async () => {
			// Given
			const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
			const findUniqueMock = jest.fn().mockResolvedValue(usedVerification);
			const mockTx = createMockTx({
				updateMany: updateManyMock,
				findUnique: findUniqueMock,
			});

			// When
			const result = await repository.markAsUsedAtomic(
				"hashed-token-123",
				"user-123",
				VerificationType.EMAIL_VERIFY,
				5,
				mockTx as unknown as Parameters<typeof repository.markAsUsedAtomic>[4],
			);

			// Then
			expect(result).toEqual(usedVerification);
			expect(updateManyMock).toHaveBeenCalled();
			expect(findUniqueMock).toHaveBeenCalled();
			expect(mockDatabase.verification.updateMany).not.toHaveBeenCalled();
		});
	});

	describe("invalidateAllByUserIdAndType", () => {
		it("사용자의 특정 타입 미사용 인증을 모두 무효화한다", async () => {
			// Given
			mockDatabase.verification.updateMany.mockResolvedValue({ count: 3 });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
			);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.verification.updateMany).toHaveBeenCalledWith({
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
			mockDatabase.verification.updateMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.PASSWORD_RESET,
			);

			// Then
			expect(result).toBe(0);
		});

		it("트랜잭션 클라이언트를 사용하여 무효화한다", async () => {
			// Given
			const updateManyMock = jest.fn().mockResolvedValue({ count: 2 });
			const mockTx = createMockTx({ updateMany: updateManyMock });

			// When
			const result = await repository.invalidateAllByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				mockTx as unknown as Parameters<
					typeof repository.invalidateAllByUserIdAndType
				>[2],
			);

			// Then
			expect(result).toBe(2);
			expect(updateManyMock).toHaveBeenCalled();
			expect(mockDatabase.verification.updateMany).not.toHaveBeenCalled();
		});
	});

	describe("countRecentByUserIdAndType", () => {
		it("특정 기간 내 인증 발송 횟수를 카운트한다", async () => {
			// Given
			mockDatabase.verification.count.mockResolvedValue(3);
			const since = new Date("2025-01-14T00:00:00Z");

			// When
			const result = await repository.countRecentByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				since,
			);

			// Then
			expect(result).toBe(3);
			expect(mockDatabase.verification.count).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: VerificationType.EMAIL_VERIFY,
					createdAt: { gte: since },
				},
			});
		});

		it("트랜잭션 클라이언트를 사용하여 카운트한다", async () => {
			// Given
			const countMock = jest.fn().mockResolvedValue(5);
			const mockTx = createMockTx({ count: countMock });
			const since = new Date("2025-01-14T00:00:00Z");

			// When
			const result = await repository.countRecentByUserIdAndType(
				"user-123",
				VerificationType.EMAIL_VERIFY,
				since,
				mockTx as unknown as Parameters<
					typeof repository.countRecentByUserIdAndType
				>[3],
			);

			// Then
			expect(result).toBe(5);
			expect(countMock).toHaveBeenCalled();
			expect(mockDatabase.verification.count).not.toHaveBeenCalled();
		});
	});

	describe("deleteExpired", () => {
		it("만료된 인증과 사용된 인증을 삭제한다", async () => {
			// Given
			mockDatabase.verification.deleteMany.mockResolvedValue({ count: 10 });

			// When
			const result = await repository.deleteExpired();

			// Then
			expect(result).toBe(10);
			expect(mockDatabase.verification.deleteMany).toHaveBeenCalledWith({
				where: {
					OR: [
						{ expiresAt: { lt: expect.any(Date) } },
						{ usedAt: { not: null } },
					],
				},
			});
		});

		it("삭제할 인증이 없으면 0을 반환한다", async () => {
			// Given
			mockDatabase.verification.deleteMany.mockResolvedValue({ count: 0 });

			// When
			const result = await repository.deleteExpired();

			// Then
			expect(result).toBe(0);
		});
	});
});
