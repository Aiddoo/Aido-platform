import { UserPreferenceBuilder } from "#test/builders/index";
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
import {
	assertNativeWhere,
	createMockTransactionHost,
	databaseFixture,
	databaseWriteExpectation,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import {
	type UpdatePreferenceData,
	UserPreferenceRepository,
} from "./user-preference.repository.js";

describe("UserPreferenceRepository — 사용자 환경설정 리포지토리", () => {
	let repository: UserPreferenceRepository;
	let db: MockDatabaseContext;

	// Builder로 기본 테스트 설정 생성
	const mockUserPreference = UserPreferenceBuilder.create("user-123")
		.withId("pref-123")
		.withPushEnabled(true)
		.withNightPushEnabled(false)
		.build();

	beforeEach(async () => {
		// Given - Suites가 모든 의존성을 자동으로 mock
		db = createMockDatabaseContext();

		repository = new UserPreferenceRepository(createMockTransactionHost(db));

		// ID 카운터 리셋
		UserPreferenceBuilder.resetIdCounter();
	});

	describe("findByUserId", () => {
		it("사용자 ID로 푸시 설정을 조회한다", async () => {
			// Given
			db.orm.public.UserPreference.first.mockResolvedValue(
				databaseFixture("UserPreference", mockUserPreference),
			);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(mockUserPreference);
			assertNativeWhere(
				"UserPreference",
				db.orm.public.UserPreference.where.mock.calls[0]?.[0],
				(row) => row.userId.eq("user-123"),
			);
		});

		it("설정이 없으면 null을 반환한다", async () => {
			// Given
			db.orm.public.UserPreference.first.mockResolvedValue(databaseFixture("UserPreference", null));

			// When
			const result = await repository.findByUserId("nonexistent-user");

			// Then
			expect(result).toBeNull();
		});

		it("활성 트랜잭션 클라이언트로 조회한다", async () => {
			// Given
			db.orm.public.UserPreference.first.mockResolvedValue(
				databaseFixture("UserPreference", mockUserPreference),
			);

			// When
			const result = await repository.findByUserId("user-123");

			// Then
			expect(result).toEqual(mockUserPreference);
			assertNativeWhere(
				"UserPreference",
				db.orm.public.UserPreference.where.mock.calls[0]?.[0],
				(row) => row.userId.eq("user-123"),
			);
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
			db.orm.public.UserPreference.create.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.create("user-123");

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.create).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						userId: "user-123",
						pushEnabled: true,
						nightPushEnabled: true,
					}),
				),
			);
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
			db.orm.public.UserPreference.create.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.create("user-123", createData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.create).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						userId: "user-123",
						pushEnabled: true,
						nightPushEnabled: true,
					}),
				),
			);
		});

		it("활성 트랜잭션 클라이언트로 생성한다", async () => {
			// Given
			const expectedPreference = UserPreferenceBuilder.create("user-123")
				.withId("tx-pref-123")
				.withPushEnabled(true)
				.withNightPushEnabled(true)
				.build();
			db.orm.public.UserPreference.create.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.create("user-123", undefined);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.create).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						userId: "user-123",
						pushEnabled: true,
						nightPushEnabled: true,
					}),
				),
			);
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
			db.orm.public.UserPreference.upsert.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					conflictOn: databaseWriteExpectation("UserPreference", { userId: "user-123" }),
					create: expect.objectContaining(
						databaseWriteExpectation("UserPreference", {
							userId: "user-123",
							pushEnabled: true,
							nightPushEnabled: true,
						}),
					),
					update: expect.objectContaining(
						databaseWriteExpectation("UserPreference", {
							pushEnabled: true,
						}),
					),
				}),
			);
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
			db.orm.public.UserPreference.upsert.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					conflictOn: databaseWriteExpectation("UserPreference", { userId: "user-123" }),
					create: expect.objectContaining(
						databaseWriteExpectation("UserPreference", {
							userId: "user-123",
							pushEnabled: true,
							nightPushEnabled: true,
						}),
					),
					update: expect.objectContaining(
						databaseWriteExpectation("UserPreference", {
							nightPushEnabled: true,
						}),
					),
				}),
			);
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
			db.orm.public.UserPreference.upsert.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.upsert("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.upsert).toHaveBeenCalled();
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
			db.orm.public.UserPreference.update.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.update).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						pushEnabled: false,
					}),
				),
			);
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
			db.orm.public.UserPreference.update.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.update).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						nightPushEnabled: true,
					}),
				),
			);
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
			db.orm.public.UserPreference.update.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.update).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						pushEnabled: true,
						nightPushEnabled: true,
					}),
				),
			);
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
			db.orm.public.UserPreference.update.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.update).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						morningReminderHour: 9,
						morningReminderMinute: 30,
						eveningReminderHour: 20,
						eveningReminderMinute: 30,
					}),
				),
			);
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
			db.orm.public.UserPreference.update.mockResolvedValue(
				databaseFixture("UserPreference", expectedPreference),
			);

			// When
			const result = await repository.update("user-123", updateData);

			// Then
			expect(result).toEqual(expectedPreference);
			expect(db.orm.public.UserPreference.update).toHaveBeenCalledWith(
				expect.objectContaining(
					databaseWriteExpectation("UserPreference", {
						pushEnabled: true,
					}),
				),
			);
		});
	});
});
