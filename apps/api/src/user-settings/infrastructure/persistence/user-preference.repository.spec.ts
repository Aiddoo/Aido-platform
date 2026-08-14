/**
 * UserPreferenceRepository 리포지토리 단위 테스트
 *
 * @description
 * UserPreferenceRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test user-preference.repository
 * ```
 */
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { UserPreferenceBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { type UpdatePreferenceData, UserPreferenceRepository } from "./user-preference.repository";

describe("UserPreferenceRepository — 사용자 환경설정 리포지토리", () => {
	let repository: UserPreferenceRepository;
	let db: MockPrismaClient;

	// Builder로 기본 테스트 설정 생성
	const mockUserPreference = UserPreferenceBuilder.create("user-123")
		.withId("pref-123")
		.withPushEnabled(true)
		.withNightPushEnabled(false)
		.build();

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(UserPreferenceRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(TransactionHost)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;

		// ID 카운터 리셋
		UserPreferenceBuilder.resetIdCounter();
	});

	describe("findByUserId", () => {
		it("사용자 ID로 푸시 설정을 조회한다", async () => {
			// Given
			db.userPreference.findUnique.mockResolvedValue(mockUserPreference);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(mockUserPreference);
			expect(db.userPreference.findUnique).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});

		it("설정이 없으면 null을 반환한다", async () => {
			// Given
			db.userPreference.findUnique.mockResolvedValue(null);

			// When
			const result = await repository.findByUserId("nonexistent-user");

			// Then
			expect(result).toBeNull();
		});

		it("활성 트랜잭션 클라이언트로 조회한다", async () => {
			// Given
			db.userPreference.findUnique.mockResolvedValue(mockUserPreference);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(mockUserPreference);
			expect(db.userPreference.findUnique).toHaveBeenCalledWith({
				where: { userId: "user-123" },
			});
		});
	});

	describe("create", () => {
		it("기본값으로 푸시 설정을 생성한다", async () => {
			// Given
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("new-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create("user-123");

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});

		it("지정된 값으로 푸시 설정을 생성한다", async () => {
			// Given
			const createData: Partial<UpdatePreferenceData> = {
				pushEnabled: true,
				nightPushEnabled: true,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("new-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create("user-123", createData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 생성한다", async () => {
			// Given
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("tx-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.create.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.create("user-123", undefined);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.create).toHaveBeenCalledWith({
				data: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});
	});

	describe("upsert", () => {
		it("설정이 없으면 생성한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("new-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.upsert).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				create: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
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
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.upsert).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				create: {
					userId: "user-123",
					pushEnabled: true,
					nightPushEnabled: true,
				},
				update: {
					nightPushEnabled: true,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 upsert한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
				nightPushEnabled: true,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("tx-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.upsert.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.upsert).toHaveBeenCalled();
		});
	});

	describe("update", () => {
		it("pushEnabled만 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: false,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("pref-123")
				.withPushDisabled()
				.withNightPushEnabled(false)
				.build();
			db.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.update).toHaveBeenCalledWith({
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
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.update).toHaveBeenCalledWith({
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
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					pushEnabled: true,
					nightPushEnabled: true,
				},
			});
		});

		it("리마인더 분(minute) 필드를 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				morningReminderHour: 9,
				morningReminderMinute: 30,
				eveningReminderHour: 20,
				eveningReminderMinute: 30,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("pref-123")
				.withMorningReminderHour(9)
				.withMorningReminderMinute(30)
				.withEveningReminderHour(20)
				.withEveningReminderMinute(30)
				.build();
			db.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					morningReminderHour: 9,
					morningReminderMinute: 30,
					eveningReminderHour: 20,
					eveningReminderMinute: 30,
				},
			});
		});

		it("활성 트랜잭션 클라이언트로 업데이트한다", async () => {
			// Given
			const updateData: UpdatePreferenceData = {
				pushEnabled: true,
			};
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("tx-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(false)
				.build();
			db.userPreference.update.mockResolvedValue(expectedPreference);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.userPreference.update).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				data: {
					pushEnabled: true,
				},
			});
		});
	});
});
