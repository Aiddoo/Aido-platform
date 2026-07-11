/**
 * user-settings 유스케이스 통합 테스트
 *
 * @description
 * GetPreference·UpdatePreference·UpdateMarketingConsent 유스케이스가 실제 Prisma
 * 리포지토리(포트 구현) 및 EntitlementService·CacheService·리마인더 큐 포트와 함께
 * 올바르게 작동하는지 검증합니다. 실제 DB 대신 모킹된 DatabaseService를 사용합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test user-settings.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import { UserConsentBuilder, UserPreferenceBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { REMINDER_SCHEDULE_ENQUEUER } from "@/user-settings/application/ports/reminder-schedule.enqueuer.port";
import { USER_CONSENT_REPOSITORY } from "@/user-settings/application/ports/user-consent.repository.port";
import { USER_PREFERENCE_REPOSITORY } from "@/user-settings/application/ports/user-preference.repository.port";
import { GetPreferenceUseCase } from "@/user-settings/application/use-cases/get-preference/get-preference.use-case";
import { UpdateMarketingConsentUseCase } from "@/user-settings/application/use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdatePreferenceUseCase } from "@/user-settings/application/use-cases/update-preference/update-preference.use-case";
import { UserConsentRepository } from "@/user-settings/infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "@/user-settings/infrastructure/persistence/user-preference.repository";

describe("user-settings 유스케이스 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let getPreference: GetPreferenceUseCase;
	let updatePreference: UpdatePreferenceUseCase;
	let updateMarketingConsent: UpdateMarketingConsentUseCase;

	const mockUserPreferenceDb = {
		findUnique: jest.fn(),
		upsert: jest.fn(),
	};

	const mockUserConsentDb = {
		findUnique: jest.fn(),
		upsert: jest.fn(),
	};

	const mockDatabaseService = createMockDatabaseService({
		userPreference: mockUserPreferenceDb,
		userConsent: mockUserConsentDb,
	});

	const mockEntitlementService = {
		hasPremiumAccess: jest.fn(),
	};

	const mockCacheService = {
		wrapUserPreference: jest
			.fn()
			.mockImplementation((_id: string, factory: () => Promise<unknown>) =>
				factory(),
			),
		invalidateUserPreference: jest.fn(),
		invalidateActiveTimezones: jest.fn(),
	};

	const mockReminderEnqueuer = {
		enqueueReminderHourChanged: jest.fn(),
	};

	const mockUserId = "user-settings-123";

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				GetPreferenceUseCase,
				UpdatePreferenceUseCase,
				UpdateMarketingConsentUseCase,
				UserPreferenceRepository,
				UserConsentRepository,
				{
					provide: USER_PREFERENCE_REPOSITORY,
					useExisting: UserPreferenceRepository,
				},
				{
					provide: USER_CONSENT_REPOSITORY,
					useExisting: UserConsentRepository,
				},
				{ provide: DatabaseService, useValue: mockDatabaseService },
				{
					// CLS 트랜잭션 스텁 — tx가 mock DB 클라이언트를 반환
					provide: TransactionHost,
					useValue: { tx: mockDatabaseService },
				},
				{ provide: EntitlementService, useValue: mockEntitlementService },
				{ provide: CacheService, useValue: mockCacheService },
				{ provide: REMINDER_SCHEDULE_ENQUEUER, useValue: mockReminderEnqueuer },
			],
		}).compile();

		getPreference = module.get(GetPreferenceUseCase);
		updatePreference = module.get(UpdatePreferenceUseCase);
		updateMarketingConsent = module.get(UpdateMarketingConsentUseCase);
	});

	afterAll(async () => {
		await module.close();
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		UserPreferenceBuilder.resetIdCounter();
	});

	describe("설정 조회 통합 테스트", () => {
		it("설정 조회 — 기존 설정이 있으면 반환한다", async () => {
			const mockPreference = UserPreferenceBuilder.create(mockUserId)
				.withTimezone("Asia/Seoul")
				.withMorningReminderHour(7)
				.withMorningReminderMinute(30)
				.build();

			mockUserPreferenceDb.findUnique.mockResolvedValue(mockPreference);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			const result = await getPreference.execute(mockUserId);

			expect(result.timezone).toBe("Asia/Seoul");
			expect(result.morningReminderHour).toBe(7);
			expect(result.morningReminderMinute).toBe(30);
		});

		it("설정 조회 — 설정이 없으면 기본값을 반환한다", async () => {
			mockUserPreferenceDb.findUnique.mockResolvedValue(null);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			const result = await getPreference.execute(mockUserId);

			expect(result.pushEnabled).toBe(false);
			expect(result.nightPushEnabled).toBe(false);
			expect(result.timezone).toBe("UTC");
			expect(result.morningReminderHour).toBe(8);
			expect(result.morningReminderMinute).toBe(0);
			expect(result.eveningReminderHour).toBe(18);
			expect(result.eveningReminderMinute).toBe(0);
		});

		it("설정 조회 — 무료 유저는 리마인더 시간이 기본값으로 오버라이드된다", async () => {
			const mockPreference = UserPreferenceBuilder.create(mockUserId)
				.withMorningReminderHour(6)
				.withMorningReminderMinute(30)
				.withEveningReminderHour(20)
				.withEveningReminderMinute(30)
				.build();

			mockUserPreferenceDb.findUnique.mockResolvedValue(mockPreference);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			const result = await getPreference.execute(mockUserId);

			expect(result.morningReminderHour).toBe(8);
			expect(result.morningReminderMinute).toBe(0);
			expect(result.eveningReminderHour).toBe(18);
			expect(result.eveningReminderMinute).toBe(0);
			expect(result.pushEnabled).toBe(mockPreference.pushEnabled);
		});
	});

	describe("설정 수정 통합 테스트", () => {
		it("설정 수정 — 프리미엄 유저가 리마인더 시간을 변경하면 캐시 무효화 및 큐 enqueue된다", async () => {
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);
			const updatedPreference = UserPreferenceBuilder.create(mockUserId)
				.withMorningReminderHour(7)
				.withMorningReminderMinute(30)
				.withTimezone("Asia/Seoul")
				.build();
			mockUserPreferenceDb.upsert.mockResolvedValue(updatedPreference);

			const result = await updatePreference.execute(mockUserId, {
				morningReminderHour: 7,
				morningReminderMinute: 30,
			});

			expect(result.morningReminderHour).toBe(7);
			expect(result.morningReminderMinute).toBe(30);
			expect(mockCacheService.invalidateUserPreference).toHaveBeenCalledWith(
				mockUserId,
			);
			expect(
				mockReminderEnqueuer.enqueueReminderHourChanged,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					morningReminderHour: 7,
					morningReminderMinute: 30,
				}),
			);
		});

		it("설정 수정 — 무료 유저가 리마인더 시간 변경 시 PREFERENCE_1701을 반환한다", async () => {
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			await expect(
				updatePreference.execute(mockUserId, { morningReminderHour: 6 }),
			).rejects.toMatchObject({ errorCode: "PREFERENCE_1701" });
		});

		it("설정 수정 — 범위 밖의 아침 리마인더 시간은 PREFERENCE_1702를 반환한다", async () => {
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			await expect(
				updatePreference.execute(mockUserId, { morningReminderHour: 13 }),
			).rejects.toMatchObject({ errorCode: "PREFERENCE_1702" });
		});
	});

	describe("마케팅 동의 통합 테스트", () => {
		it("마케팅 동의 — 동의/철회 시 marketingAgreedAt이 올바르게 설정된다", async () => {
			const consentWithMarketing = UserConsentBuilder.create(mockUserId)
				.withMarketingConsent()
				.build();
			mockUserConsentDb.upsert.mockResolvedValue(consentWithMarketing);

			const agreedResult = await updateMarketingConsent.execute(
				mockUserId,
				true,
			);
			expect(agreedResult.marketingAgreedAt).not.toBeNull();

			const consentWithout = UserConsentBuilder.create(mockUserId).build();
			mockUserConsentDb.upsert.mockResolvedValue(consentWithout);

			const revokedResult = await updateMarketingConsent.execute(
				mockUserId,
				false,
			);
			expect(revokedResult.marketingAgreedAt).toBeNull();
		});
	});
});
