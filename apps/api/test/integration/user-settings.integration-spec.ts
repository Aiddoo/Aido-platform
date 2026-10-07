import { USER_PREFERENCE_DEFAULTS } from "@aido/api";
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
 * pnpm --filter @aido/server test user-settings.integration-spec
 * ```
 */
import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { vi } from "vitest";

import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { REMINDER_SCHEDULE_ENQUEUER } from "#api/modules/identity/application/ports/settings/reminder-schedule.enqueuer.port";
import { USER_CONSENT_REPOSITORY } from "#api/modules/identity/application/ports/settings/user-consent.repository.port";
import { USER_PREFERENCE_REPOSITORY } from "#api/modules/identity/application/ports/settings/user-preference.repository.port";
import { USER_SETTINGS_CACHE } from "#api/modules/identity/application/ports/settings/user-settings-cache.port";
import { GetPreference } from "#api/modules/identity/application/use-cases/settings/get-preference.use-case";
import { UpdateMarketingConsent } from "#api/modules/identity/application/use-cases/settings/update-marketing-consent.use-case";
import { UpdatePreference } from "#api/modules/identity/application/use-cases/settings/update-preference.use-case";
import { UserSettingsCacheAdapter } from "#api/modules/identity/infrastructure/adapters/settings/user-settings-cache.adapter";
import { UserSettingsCacheKey } from "#api/modules/identity/infrastructure/cache/settings/user-settings-cache.keyspace";
import { UserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-consent.repository";
import { UserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-preference.repository";
import { CacheService } from "#api/platform/cache/cache.service";
import { DatabaseService } from "#api/platform/database/database.service";
import { UserConsentBuilder, UserPreferenceBuilder } from "#test/builders/index";
import { TEST_CUID } from "#test/fixtures/index";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import { createMockDatabaseContext, databaseFixture } from "#test/mocks/database.mock";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";
import { suppressLogger } from "#test/setup/suppress-logger";

import { updateMarketingConsentProvider } from "../../src/modules/identity/identity-settings-application.providers.js";
import { updatePreferenceProvider } from "../../src/modules/identity/identity-settings-application.providers.js";
import { getPreferenceProvider } from "../../src/modules/identity/identity-settings-application.providers.js";

describe("user-settings 유스케이스 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let getPreference: GetPreference;
  let updatePreference: UpdatePreference;
  let updateMarketingConsent: UpdateMarketingConsent;

  const nativeContext = createMockDatabaseContext();
  const mockUserPreferenceDb = nativeContext.orm.public.UserPreference;

  const mockUserConsentDb = nativeContext.orm.public.UserConsent;

  const mockDatabaseService = createMockDatabaseService(nativeContext);

  const mockEntitlementService = {
    hasPremiumAccess: vi.fn(),
  };

  const mockCacheService = createMockCacheService();

  const mockReminderEnqueuer = {
    enqueueReminderHourChanged: vi.fn(),
  };

  const mockUserId = TEST_CUID.USER_1;

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        getPreferenceProvider,
        updatePreferenceProvider,
        updateMarketingConsentProvider,
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
          useValue: { tx: nativeContext },
        },
        { provide: EntitlementService, useValue: mockEntitlementService },
        { provide: CacheService, useValue: mockCacheService },
        // application은 USER_SETTINGS_CACHE 포트에 의존 — 실제 어댑터가 mock CacheService를 래핑
        { provide: USER_SETTINGS_CACHE, useClass: UserSettingsCacheAdapter },
        { provide: REMINDER_SCHEDULE_ENQUEUER, useValue: mockReminderEnqueuer },
      ],
    }).compile();

    getPreference = module.get(GetPreference);
    updatePreference = module.get(UpdatePreference);
    updateMarketingConsent = module.get(UpdateMarketingConsent);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.wrap.mockImplementation((_key, factory) => factory());
    UserPreferenceBuilder.resetIdCounter();
  });

  describe("설정 조회 통합 테스트", () => {
    it("설정 조회 — 기존 설정이 있으면 반환한다", async () => {
      const mockPreference = UserPreferenceBuilder.create(mockUserId)
        .withTimezone("Asia/Seoul")
        .withMorningReminderHour(7)
        .withMorningReminderMinute(30)
        .build();

      mockUserPreferenceDb.first.mockResolvedValue(
        databaseFixture("UserPreference", mockPreference),
      );
      mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

      const result = await getPreference.execute(mockUserId);

      expect(result.timezone).toBe("Asia/Seoul");
      expect(result.morningReminderHour).toBe(7);
      expect(result.morningReminderMinute).toBe(30);
    });

    it("설정 조회 — 설정이 없으면 기본값을 반환한다", async () => {
      mockUserPreferenceDb.first.mockResolvedValue(databaseFixture("UserPreference", null));
      mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

      const result = await getPreference.execute(mockUserId);

      expect(result.pushEnabled).toBe(false);
      expect(result.nightPushEnabled).toBe(false);
      expect(result.timezone).toBe("UTC");
      expect(result.morningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR);
      expect(result.morningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE);
      expect(result.eveningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR);
      expect(result.eveningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE);
    });

    it("설정 조회 — 무료 유저는 리마인더 시간이 기본값으로 오버라이드된다", async () => {
      const mockPreference = UserPreferenceBuilder.create(mockUserId)
        .withMorningReminderHour(6)
        .withMorningReminderMinute(30)
        .withEveningReminderHour(20)
        .withEveningReminderMinute(30)
        .build();

      mockUserPreferenceDb.first.mockResolvedValue(
        databaseFixture("UserPreference", mockPreference),
      );
      mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

      const result = await getPreference.execute(mockUserId);

      expect(result.morningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR);
      expect(result.morningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE);
      expect(result.eveningReminderHour).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR);
      expect(result.eveningReminderMinute).toBe(USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE);
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
      mockUserPreferenceDb.upsert.mockResolvedValue(
        databaseFixture("UserPreference", updatedPreference),
      );

      const result = await updatePreference.execute(mockUserId, {
        morningReminderHour: 7,
        morningReminderMinute: 30,
      });

      expect(result.morningReminderHour).toBe(7);
      expect(result.morningReminderMinute).toBe(30);
      expect(mockCacheService.del).toHaveBeenCalledWith(
        UserSettingsCacheKey.preference(mockUserId),
      );
      expect(mockReminderEnqueuer.enqueueReminderHourChanged).toHaveBeenCalledWith(
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

    it("설정 수정 — 유효하지 않은 IANA 타임존은 SYS_0002이며 DB를 호출하지 않는다", async () => {
      await expect(
        updatePreference.execute(mockUserId, {
          timezone: "Invalid/Timezone",
        }),
      ).rejects.toMatchObject({
        errorCode: "SYS_0002",
        details: { field: "timezone" },
      });
      expect(mockUserPreferenceDb.upsert).not.toHaveBeenCalled();
    });
  });

  describe("마케팅 동의 통합 테스트", () => {
    it("마케팅 동의 — 동의/철회 시 marketingAgreedAt이 올바르게 설정된다", async () => {
      const consentWithMarketing = UserConsentBuilder.create(mockUserId)
        .withMarketingConsent()
        .build();
      mockUserConsentDb.upsert.mockResolvedValue(
        databaseFixture("UserConsent", consentWithMarketing),
      );

      const agreedResult = await updateMarketingConsent.execute(mockUserId, true);
      expect(agreedResult.marketingAgreedAt).not.toBeNull();

      const consentWithout = UserConsentBuilder.create(mockUserId).build();
      mockUserConsentDb.upsert.mockResolvedValue(databaseFixture("UserConsent", consentWithout));

      const revokedResult = await updateMarketingConsent.execute(mockUserId, false);
      expect(revokedResult.marketingAgreedAt).toBeNull();
    });
  });
});
