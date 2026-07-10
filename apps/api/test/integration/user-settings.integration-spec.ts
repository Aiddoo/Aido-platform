/**
 * UserSettingsService 통합 테스트
 *
 * @description
 * UserSettingsService가 UserPreferenceRepository, UserConsentRepository, EntitlementService,
 * CacheService, TimezoneReminderQueueService와 함께 올바르게 작동하는지 검증합니다.
 * 실제 데이터베이스 대신 모킹된 DatabaseService를 사용하여 서비스 계층 통합을 테스트합니다.
 *
 * 통합 테스트의 목적:
 * - NestJS 의존성 주입이 올바르게 작동하는지 검증
 * - UserSettingsService와 Repository의 통합 검증
 * - EntitlementService 프리미엄 체크 로직 검증
 * - CacheService 무효화 로직 검증
 * - BusinessException 에러 처리가 올바르게 작동하는지 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test user-settings.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { UserConsentBuilder, UserPreferenceBuilder } from "@test/builders";
import { createMockDatabaseService } from "@test/mocks/mock-database.factory";
import { suppressLogger } from "@test/setup/suppress-logger";
import { TimezoneReminderQueueService } from "@/scheduler/queue";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { UserConsentRepository } from "@/user-settings/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/user-settings/repositories/user-preference.repository";
import { UserSettingsService } from "@/user-settings/services/user-settings.service";

describe("UserSettingsService 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let service: UserSettingsService;

	// Mock 데이터베이스 서비스
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

	// Mock 서비스
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

	const mockQueueService = {
		enqueueReminderHourChanged: jest.fn(),
	};

	// 테스트 데이터
	const mockUserId = "user-settings-123";

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				UserSettingsService,
				UserPreferenceRepository,
				UserConsentRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabaseService,
				},
				{
					provide: EntitlementService,
					useValue: mockEntitlementService,
				},
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
				{
					provide: TimezoneReminderQueueService,
					useValue: mockQueueService,
				},
			],
		}).compile();

		service = module.get<UserSettingsService>(UserSettingsService);
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
			// Given - 기존 설정이 저장되어 있는 사용자
			const mockPreference = UserPreferenceBuilder.create(mockUserId)
				.withTimezone("Asia/Seoul")
				.withMorningReminderHour(7)
				.withMorningReminderMinute(30)
				.build();

			mockUserPreferenceDb.findUnique.mockResolvedValue(mockPreference);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			// When - 설정 조회
			const result = await service.getPreference(mockUserId);

			// Then - 저장된 설정이 반환되어야 함
			expect(result.timezone).toBe("Asia/Seoul");
			expect(result.morningReminderHour).toBe(7);
			expect(result.morningReminderMinute).toBe(30);
		});

		it("설정 조회 — 설정이 없으면 기본값을 반환한다", async () => {
			// Given - 설정이 없는 사용자
			mockUserPreferenceDb.findUnique.mockResolvedValue(null);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			// When - 설정 조회
			const result = await service.getPreference(mockUserId);

			// Then - 기본값이 반환되어야 함
			expect(result.pushEnabled).toBe(false);
			expect(result.nightPushEnabled).toBe(false);
			expect(result.timezone).toBe("UTC");
			expect(result.morningReminderHour).toBe(8);
			expect(result.morningReminderMinute).toBe(0);
			expect(result.eveningReminderHour).toBe(18);
			expect(result.eveningReminderMinute).toBe(0);
		});

		it("설정 조회 — 무료 유저는 리마인더 시간이 기본값으로 오버라이드된다", async () => {
			// Given - 커스텀 리마인더 시간이 설정된 무료 유저
			const mockPreference = UserPreferenceBuilder.create(mockUserId)
				.withMorningReminderHour(6)
				.withMorningReminderMinute(30)
				.withEveningReminderHour(20)
				.withEveningReminderMinute(30)
				.build();

			mockUserPreferenceDb.findUnique.mockResolvedValue(mockPreference);
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When - 설정 조회
			const result = await service.getPreference(mockUserId);

			// Then - 리마인더 시간이 기본값으로 오버라이드되어야 함
			expect(result.morningReminderHour).toBe(8);
			expect(result.morningReminderMinute).toBe(0);
			expect(result.eveningReminderHour).toBe(18);
			expect(result.eveningReminderMinute).toBe(0);
			// pushEnabled 등은 유지되어야 함
			expect(result.pushEnabled).toBe(mockPreference.pushEnabled);
		});
	});

	describe("설정 수정 통합 테스트", () => {
		it("설정 수정 — 프리미엄 유저가 리마인더 시간을 변경하면 캐시 무효화 및 큐 enqueue된다", async () => {
			// Given - 프리미엄 유저
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);
			const updatedPreference = UserPreferenceBuilder.create(mockUserId)
				.withMorningReminderHour(7)
				.withMorningReminderMinute(30)
				.withTimezone("Asia/Seoul")
				.build();
			mockUserPreferenceDb.upsert.mockResolvedValue(updatedPreference);

			// When - 리마인더 시간 변경
			const result = await service.updatePreference(mockUserId, {
				morningReminderHour: 7,
				morningReminderMinute: 30,
			});

			// Then - 캐시 무효화 및 큐 enqueue 검증
			expect(result.morningReminderHour).toBe(7);
			expect(result.morningReminderMinute).toBe(30);
			expect(mockCacheService.invalidateUserPreference).toHaveBeenCalledWith(
				mockUserId,
			);
			expect(mockQueueService.enqueueReminderHourChanged).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					morningReminderHour: 7,
					morningReminderMinute: 30,
				}),
			);
		});

		it("설정 수정 — 무료 유저가 리마인더 시간 변경 시 에러를 반환한다", async () => {
			// Given - 무료 유저
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then - 리마인더 시간 변경 시도 시 에러 발생
			await expect(
				service.updatePreference(mockUserId, {
					morningReminderHour: 6,
				}),
			).rejects.toThrow(BusinessException);
		});

		it("설정 수정 — 범위 밖의 아침 리마인더 시간은 에러를 반환한다", async () => {
			// Given - 프리미엄 유저 + 범위 밖의 아침 리마인더 시간 (12시 이상)
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

			// When & Then - 오전 범위 초과 시 에러 발생
			await expect(
				service.updatePreference(mockUserId, {
					morningReminderHour: 13,
				}),
			).rejects.toThrow(BusinessException);
		});
	});

	describe("마케팅 동의 통합 테스트", () => {
		it("마케팅 동의 — 동의/철회 시 marketingAgreedAt이 올바르게 설정된다", async () => {
			// Given - 마케팅 동의
			const consentWithMarketing = UserConsentBuilder.create(mockUserId)
				.withMarketingConsent()
				.build();
			mockUserConsentDb.upsert.mockResolvedValue(consentWithMarketing);

			// When - 마케팅 동의
			const agreedResult = await service.updateMarketingConsent(
				mockUserId,
				true,
			);

			// Then - marketingAgreedAt이 설정되어야 함
			expect(agreedResult.marketingAgreedAt).not.toBeNull();

			// Given - 마케팅 동의 철회
			const consentWithout = UserConsentBuilder.create(mockUserId).build();
			mockUserConsentDb.upsert.mockResolvedValue(consentWithout);

			// When - 마케팅 동의 철회
			const revokedResult = await service.updateMarketingConsent(
				mockUserId,
				false,
			);

			// Then - marketingAgreedAt이 null이어야 함
			expect(revokedResult.marketingAgreedAt).toBeNull();
		});
	});
});
