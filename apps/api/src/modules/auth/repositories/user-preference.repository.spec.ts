import { Test, type TestingModule } from "@nestjs/testing";
import { asTxClient, createMockTxClient } from "@test/mocks/transaction.mock";
import { DatabaseService } from "@/database";
import type { UserPreference } from "@/generated/prisma/client";
import {
	type UpdatePreferenceData,
	UserPreferenceRepository,
} from "./user-preference.repository";

describe("UserPreferenceRepository", () => {
	let repository: UserPreferenceRepository;
	let mockDatabase: {
		userPreference: {
			findUnique: jest.Mock;
			create: jest.Mock;
			update: jest.Mock;
			upsert: jest.Mock;
		};
	};

	const mockUserPreference: UserPreference = {
		id: "pref-123",
		userId: "user-123",
		pushEnabled: true,
		nightPushEnabled: false,
	};

	beforeEach(async () => {
		mockDatabase = {
			userPreference: {
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				upsert: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserPreferenceRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<UserPreferenceRepository>(UserPreferenceRepository);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("findByUserId", () => {
		it("사용자 ID로 푸시 설정을 조회한다", async () => {
			// Given
			mockDatabase.userPreference.findUnique.mockResolvedValue(
				mockUserPreference,
			);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(mockUserPreference);
			expect(mockDatabase.userPreference.findUnique).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});

		it("설정이 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.userPreference.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByUserId("nonexistent-user");

			// Then
			expect(result).toBeNull();
		});

		it("트랜잭션 내에서 조회한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			mockTx.userPreference.findUnique.mockResolvedValue(mockUserPreference);

			// When
			const result = await repository.findByUserId(
				"user-123",
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(mockUserPreference);
			expect(mockTx.userPreference.findUnique).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
			expect(mockDatabase.userPreference.findUnique).not.toHaveBeenCalled();
		});
	});

	describe("create", () => {
		it("기본값으로 푸시 설정을 생성한다", async () => {
			// Given
			const expectedPreference: UserPreference = {
				id: "new-pref-123",
				userId: "user-123",
				pushEnabled: false,
				nightPushEnabled: false,
			};
			mockDatabase.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create("user-123");

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: false,
					nightPushEnabled: false,
				},
			});
		});

		it("지정된 값으로 푸시 설정을 생성한다", async () => {
			// Given
			const createData: Partial<UpdatePreferenceData> = {
				pushEnabled: true,
				nightPushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "new-pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: true,
			};
			mockDatabase.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create("user-123", createData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});

		it("트랜잭션 내에서 생성한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			const expectedPreference: UserPreference = {
				id: "tx-pref-123",
				userId: "user-123",
				pushEnabled: false,
				nightPushEnabled: false,
			};
			mockTx.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create(
				"user-123",
				undefined,
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockTx.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: false,
					nightPushEnabled: false,
				},
			});
			expect(mockDatabase.userPreference.create).not.toHaveBeenCalled();
		});
	});

	describe("upsert", () => {
		it("설정이 없으면 생성한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "new-pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: false,
			};
			mockDatabase.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.upsert).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				create: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: false,
				},
				update: {
					pushEnabled: true,
				},
			});
		});

		it("설정이 있으면 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				nightPushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: true,
			};
			mockDatabase.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.upsert).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				create: {
					userId: "user-123",
					pushEnabled: false,
					nightPushEnabled: true,
				},
				update: {
					nightPushEnabled: true,
				},
			});
		});

		it("트랜잭션 내에서 upsert한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
				nightPushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "tx-pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: true,
			};
			mockTx.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert(
				"user-123",
				updateData,
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockTx.userPreference.upsert).toHaveBeenCalled();
			expect(mockDatabase.userPreference.upsert).not.toHaveBeenCalled();
		});
	});

	describe("update", () => {
		it("pushEnabled만 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: false,
			};
			const expectedPreference: UserPreference = {
				id: "pref-123",
				userId: "user-123",
				pushEnabled: false,
				nightPushEnabled: false,
			};
			mockDatabase.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					pushEnabled: false,
				},
			});
		});

		it("nightPushEnabled만 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				nightPushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: true,
			};
			mockDatabase.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					nightPushEnabled: true,
				},
			});
		});

		it("모든 설정을 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
				nightPushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: true,
			};
			mockDatabase.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockDatabase.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});

		it("트랜잭션 내에서 업데이트한다", async () => {
			// Given
			const mockTx = createMockTxClient();
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
			};
			const expectedPreference: UserPreference = {
				id: "tx-pref-123",
				userId: "user-123",
				pushEnabled: true,
				nightPushEnabled: false,
			};
			mockTx.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update(
				"user-123",
				updateData,
				asTxClient(mockTx),
			);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(mockTx.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					pushEnabled: true,
				},
			});
			expect(mockDatabase.userPreference.update).not.toHaveBeenCalled();
		});
	});
});
