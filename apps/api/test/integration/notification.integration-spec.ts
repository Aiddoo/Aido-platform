import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import { UserPreferenceReader } from "#api/modules/identity/application/services/settings/user-preference-reader.service";
import { USER_PREFERENCE_READER } from "#api/modules/identity/identity-settings.public";
import { UserSettingsCacheAdapter } from "#api/modules/identity/infrastructure/adapters/settings/user-settings-cache.adapter";
import { UserConsentRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-consent.repository";
import { UserPreferenceRepository } from "#api/modules/identity/infrastructure/persistence/settings/user-preference.repository";
import { ACTIVE_PUSH_TOKEN_READER } from "#api/modules/notification/application/ports/delivery/active-push-token.reader.port";
import { MARKETING_PUSH_OPT_OUT_TOKEN } from "#api/modules/notification/application/ports/delivery/marketing-push-opt-out-token.port";
import { NOTIFICATION_CACHE } from "#api/modules/notification/application/ports/delivery/notification-cache.port";
import {
  NOTIFICATION_DEDUP,
  NOTIFICATION_DEDUP_LOCK,
} from "#api/modules/notification/application/ports/delivery/notification-dedup.port";
import { NOTIFICATION_HISTORY_READER } from "#api/modules/notification/application/ports/delivery/notification-history.reader.port";
import { NOTIFICATION_INBOX_READER } from "#api/modules/notification/application/ports/delivery/notification-inbox.reader.port";
import { NOTIFICATION_RECIPIENT_LOCALE_READER } from "#api/modules/notification/application/ports/delivery/notification-recipient-locale.reader.port";
import { NOTIFICATION_RECIPIENT_PREFERENCE_READER } from "#api/modules/notification/application/ports/delivery/notification-recipient-preference.reader.port";
import { NOTIFICATION_REPOSITORY } from "#api/modules/notification/application/ports/delivery/notification.repository.port";
import {
  PUSH_DISPATCH_STAGING,
  type PushDispatchStagingRepositoryPort,
} from "#api/modules/notification/application/ports/delivery/push-dispatch-staging.repository.port";
import { PUSH_RECEIPT_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-receipt.repository.port";
import { PUSH_TOKEN_REPOSITORY } from "#api/modules/notification/application/ports/delivery/push-token.repository.port";
import { USER_NOTIFICATION_SETTINGS } from "#api/modules/notification/application/ports/delivery/user-notification-settings.port";
import { PushDeliveryAfterCommitPublisher } from "#api/modules/notification/application/services/delivery/push-delivery-after-commit.publisher";
// use-case는 배럴 비공개 → 테스트 모듈 구성용 딥 임포트 (test/는 경계 검사 제외)
import { GetNotifications } from "#api/modules/notification/application/use-cases/delivery/get-notifications.use-case";
import { GetUnreadCount } from "#api/modules/notification/application/use-cases/delivery/get-unread-count.use-case";
import { MarkAllAsRead } from "#api/modules/notification/application/use-cases/delivery/mark-all-as-read.use-case";
import { MarkAsRead } from "#api/modules/notification/application/use-cases/delivery/mark-as-read.use-case";
import { MarkNotificationOpened } from "#api/modules/notification/application/use-cases/delivery/mark-notification-opened.use-case";
import { OptOutMarketingPush } from "#api/modules/notification/application/use-cases/delivery/opt-out-marketing-push.use-case";
import { RegisterPushToken } from "#api/modules/notification/application/use-cases/delivery/register-push-token.use-case";
import { SendBatchNotification } from "#api/modules/notification/application/use-cases/delivery/send-batch-notification.use-case";
import { SendNotificationWithDedup } from "#api/modules/notification/application/use-cases/delivery/send-notification-with-dedup.use-case";
import { SendNotification } from "#api/modules/notification/application/use-cases/delivery/send-notification.use-case";
import { CachedActivePushTokenReaderAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/cached-active-push-token-reader.adapter";
import { CachedNotificationRecipientPreferenceAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/cached-notification-recipient-preference.adapter";
import { NotificationCacheAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/notification-cache.adapter";
import { NotificationDedupLockAdapter } from "#api/modules/notification/infrastructure/adapters/delivery/notification-dedup-lock.adapter";
import { PrismaNotificationReader } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-notification.reader";
import { PrismaNotificationRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-notification.repository";
import { PrismaPushReceiptRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-receipt.repository";
import { PrismaPushTokenRepository } from "#api/modules/notification/infrastructure/persistence/delivery/prisma-push-token.repository";
import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
  NotificationPublisher,
  PUSH_PROVIDER,
  PUSH_RATE_LIMITER,
} from "#api/modules/notification/notification-delivery.public";
import { CacheService } from "#api/platform/cache/cache.service";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { DatabaseService } from "#api/platform/database/database.service";
import { DEDUP_PROVIDER } from "#api/platform/dedup/interfaces/dedup.interface";
import { LOCK_PROVIDER } from "#api/platform/lock/interfaces/lock.interface";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  type AfterCommitTaskRegistryPort,
  UNIT_OF_WORK,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { NotificationBuilder, PushTokenBuilder, UserPreferenceBuilder } from "#test/builders/index";
import { asMock } from "#test/mocks/bull-job.mock";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import {
  assertNativeWhere,
  assertNativeWhereContains,
  createMockDatabaseContext,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { createMockDatabaseService } from "#test/mocks/mock-database.factory";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  finalizeBatchNotificationProvider,
  findAlreadyNotifiedUsersProvider,
  getNotificationsProvider,
  getUnreadCountProvider,
  markAllAsReadProvider,
  markAsReadProvider,
  markNotificationOpenedProvider,
  optOutMarketingPushProvider,
  persistBatchNotificationProvider,
  registerPushTokenProvider,
  sendBatchNotificationProvider,
  sendNotificationProvider,
  sendNotificationWithDedupProvider,
  unregisterPushTokenProvider,
} from "../../src/modules/notification/notification-delivery-application.providers.js";
import { paginationServiceProvider } from "../../src/platform/pagination/pagination.providers.js";

function buildNotificationTestApi(module: TestingModule) {
  const publisher = new NotificationPublisher(
    module.get(SendNotification),
    module.get(SendNotificationWithDedup),
    module.get(SendBatchNotification),
  );
  const getNotificationsUseCase = module.get(GetNotifications);
  const getUnreadCountUseCase = module.get(GetUnreadCount);
  const markAsReadUseCase = module.get(MarkAsRead);
  const markNotificationOpenedUseCase = module.get(MarkNotificationOpened);
  const markAllAsReadUseCase = module.get(MarkAllAsRead);
  const registerPushTokenUseCase = module.get(RegisterPushToken);
  const optOutMarketingPushUseCase = module.get(OptOutMarketingPush);

  return {
    publish: publisher.publish.bind(publisher),
    publishWithDeduplication: publisher.publishWithDeduplication.bind(publisher),
    publishBatch: publisher.publishBatch.bind(publisher),
    registerPushToken: registerPushTokenUseCase.execute.bind(registerPushTokenUseCase),
    getNotifications: getNotificationsUseCase.execute.bind(getNotificationsUseCase),
    getUnreadCount: getUnreadCountUseCase.execute.bind(getUnreadCountUseCase),
    markAsRead: markAsReadUseCase.execute.bind(markAsReadUseCase),
    markOpened: markNotificationOpenedUseCase.execute.bind(markNotificationOpenedUseCase),
    markAllAsRead: markAllAsReadUseCase.execute.bind(markAllAsReadUseCase),
    optOutMarketingPush: optOutMarketingPushUseCase.execute.bind(optOutMarketingPushUseCase),
  };
}

describe("Notification 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let facade: ReturnType<typeof buildNotificationTestApi>;
  let repository: PrismaNotificationRepository;

  // Mock 데이터베이스 서비스
  const nativeContext = createMockDatabaseContext();
  const mockNotificationDb = nativeContext.orm.public.Notification;

  const mockPushDispatchDb = nativeContext.orm.public.PushDispatch;

  const mockPushDeliveryAttemptDb = nativeContext.orm.public.PushDeliveryAttempt;

  const mockPushTokenDb = nativeContext.orm.public.PushToken;

  const mockUserPreferenceDb = nativeContext.orm.public.UserPreference;

  const mockUserConsentDb = nativeContext.orm.public.UserConsent;

  const mockDatabaseService = {
    ...createMockDatabaseService(nativeContext),
  };

  // Mock Push Provider
  const mockPushProvider = {
    send: vi.fn(),
    sendBatch: vi.fn(),
    getReceipts: vi.fn(),
    validateToken: vi.fn(),
  };

  const mockMarketingPushOptOutToken = {
    issue: vi.fn((userId: string) => `opt-out:${userId}`),
    verify: vi.fn((token: string) => token.replace(/^opt-out:/, "") || null),
  };
  const mockPushDispatchStaging = {
    stage: vi.fn().mockImplementation(async (input: { notificationId: number }) => ({
      dispatchId: input.notificationId,
      notificationId: input.notificationId,
    })),
    stageMany: vi.fn().mockImplementation(async (inputs: readonly { notificationId: number }[]) =>
      inputs.map((input) => ({
        dispatchId: input.notificationId,
        notificationId: input.notificationId,
      })),
    ),
  } satisfies PushDispatchStagingRepositoryPort;
  const mockAfterCommitPublisher = { register: vi.fn() };

  // 테스트 데이터
  const mockUserId = "user-notification-123";
  const mockNotificationId = 1;
  const mockPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
  const releasedNotificationTypes: import("#api/modules/notification/domain/types/delivery/notification-type").NotificationType[] =
    [
      "FOLLOW_NEW",
      "FOLLOW_ACCEPTED",
      "NUDGE_RECEIVED",
      "CHEER_RECEIVED",
      "DAILY_COMPLETE",
      "FRIEND_COMPLETED",
      "TODO_REMINDER",
      "TODO_SHARED",
      "MORNING_REMINDER",
      "EVENING_REMINDER",
      "WEEKLY_ACHIEVEMENT",
      "WEEKLY_REPORT",
      "MONTHLY_REPORT",
      "AI_SUGGESTION",
      "SYSTEM_NOTICE",
      "ADMIN_BROADCAST",
      "ADMIN_TARGETED",
      "WINBACK",
      "SOCIAL_DIGEST",
      "NUDGE_SUGGEST",
      "LUNCH_NUDGE",
      "STREAK_AT_RISK",
      "WEATHER_MORNING",
      "WEATHER_EVENING",
    ];

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        PrismaNotificationRepository,
        {
          provide: NOTIFICATION_REPOSITORY,
          useExisting: PrismaNotificationRepository,
        },
        PrismaNotificationReader,
        { provide: NOTIFICATION_INBOX_READER, useExisting: PrismaNotificationReader },
        { provide: NOTIFICATION_HISTORY_READER, useExisting: PrismaNotificationReader },
        PrismaPushTokenRepository,
        { provide: PUSH_TOKEN_REPOSITORY, useExisting: PrismaPushTokenRepository },
        PrismaPushReceiptRepository,
        { provide: PUSH_RECEIPT_REPOSITORY, useExisting: PrismaPushReceiptRepository },
        {
          provide: PUSH_DISPATCH_STAGING,
          useValue: mockPushDispatchStaging,
        },
        {
          provide: UNIT_OF_WORK,
          useValue: { run: (work) => work() } satisfies UnitOfWorkPort,
        },
        {
          provide: AFTER_COMMIT_TASK_REGISTRY,
          useValue: {
            register: (task) => {
              task().catch(() => undefined);
            },
          } satisfies AfterCommitTaskRegistryPort,
        },
        {
          provide: PushDeliveryAfterCommitPublisher,
          useValue: mockAfterCommitPublisher,
        },
        CachedActivePushTokenReaderAdapter,
        {
          provide: ACTIVE_PUSH_TOKEN_READER,
          useExisting: CachedActivePushTokenReaderAdapter,
        },
        {
          provide: USER_PREFERENCE_READER,
          useFactory: (preferenceRepository: UserPreferenceRepository, cache: CacheService) =>
            new UserPreferenceReader({
              preferenceRepository,
              cache: new UserSettingsCacheAdapter(cache),
            }),
          inject: [UserPreferenceRepository, CacheService],
        },
        CachedNotificationRecipientPreferenceAdapter,
        {
          provide: NOTIFICATION_RECIPIENT_PREFERENCE_READER,
          useExisting: CachedNotificationRecipientPreferenceAdapter,
        },
        {
          provide: NOTIFICATION_RECIPIENT_LOCALE_READER,
          useExisting: CachedNotificationRecipientPreferenceAdapter,
        },
        // application은 NOTIFICATION_CACHE 포트에 의존 — 실제 어댑터가 mock CacheService를 래핑
        { provide: NOTIFICATION_CACHE, useClass: NotificationCacheAdapter },
        {
          provide: NOTIFICATION_DEDUP,
          useValue: {
            recordNotifiedUsers: vi.fn().mockResolvedValue(undefined),
          },
        },
        NotificationDedupLockAdapter,
        {
          provide: NOTIFICATION_DEDUP_LOCK,
          useExisting: NotificationDedupLockAdapter,
        },
        getNotificationsProvider,
        getUnreadCountProvider,
        markAsReadProvider,
        markNotificationOpenedProvider,
        markAllAsReadProvider,
        registerPushTokenProvider,
        unregisterPushTokenProvider,
        optOutMarketingPushProvider,
        sendNotificationProvider,
        sendNotificationWithDedupProvider,
        persistBatchNotificationProvider,
        finalizeBatchNotificationProvider,
        sendBatchNotificationProvider,
        findAlreadyNotifiedUsersProvider,
        {
          provide: MARKETING_PUSH_OPT_OUT_TOKEN,
          useValue: mockMarketingPushOptOutToken,
        },
        paginationServiceProvider,
        UserPreferenceRepository,
        UserConsentRepository,
        {
          // 푸시 발송 판단용 사용자 설정 포트 — 실제 저장소(mock DB)에 위임하여
          // 프로덕션 UserNotificationSettingsAdapter의 읽기 시맨틱을 그대로 재현
          provide: USER_NOTIFICATION_SETTINGS,
          useFactory: (
            preferenceRepository: UserPreferenceRepository,
            consentRepository: UserConsentRepository,
          ) => ({
            upsertPushTimezone: (userId: string, timezone: string) =>
              preferenceRepository.upsertTimezone(userId, timezone),
            upsertPushLocale: (userId: string, locale: string) =>
              preferenceRepository.upsertLocale(userId, locale),
            getPreferenceRecord: (userId: string) => preferenceRepository.findByUserId(userId),
            getPreferenceRecordsByUserIds: (userIds: string[]) =>
              preferenceRepository.findByUserIds(userIds),
            getConsentRecord: (userId: string) => consentRepository.findByUserId(userId),
            getConsentRecordsByUserIds: (userIds: string[]) =>
              consentRepository.findByUserIds(userIds),
            updateMarketingPushConsent: (userId: string, agreed: boolean) =>
              consentRepository
                .upsertMarketingPushConsent(userId, { agreedAt: agreed ? new Date() : null })
                .then(() => undefined),
          }),
          inject: [UserPreferenceRepository, UserConsentRepository],
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          // CLS 트랜잭션 스텁 — tx가 항상 mock DB를 반환 (기존 tx ?? database와 등가)
          provide: TransactionHost,
          useValue: { tx: nativeContext },
        },
        {
          provide: TypedConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(20),
          },
        },
        {
          provide: PUSH_PROVIDER,
          useValue: mockPushProvider,
        },
        {
          provide: CacheService,
          useFactory: () => {
            const cache = createMockCacheService();
            cache.mget.mockImplementation(async (keys) => keys.map(() => undefined));
            cache.wrap.mockImplementation((_key, factory) => factory());
            return cache;
          },
        },
        {
          provide: LOCK_PROVIDER,
          useValue: {
            acquire: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)),
            isLocked: vi.fn().mockResolvedValue(false),
          },
        },
        {
          provide: DEDUP_PROVIDER,
          useValue: {
            filterMembers: vi.fn().mockResolvedValue(new Set()),
            isMember: vi.fn().mockResolvedValue(false),
            addMembers: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PUSH_RATE_LIMITER,
          useValue: {
            isRateLimited: vi.fn().mockResolvedValue(false),
            isEngagementRateLimited: vi.fn().mockResolvedValue(false),
            reserveBatch: vi
              .fn()
              .mockImplementation(async (requests: unknown[]) => requests.map(() => false)),
            destroy: vi.fn(),
          },
        },
      ],
    }).compile();

    facade = buildNotificationTestApi(module);
    repository = module.get(PrismaNotificationRepository);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    NotificationBuilder.resetIdCounter();
    PushTokenBuilder.resetIdCounter();
    asMock(mockPushDispatchDb.upsert).mockResolvedValue(databaseFixture("PushDispatch", { id: 1 }));
    asMock(mockPushDispatchDb.update).mockResolvedValue(databaseFixture("PushDispatch", {}));
    asMock(mockPushDispatchDb.updateAndCount).mockResolvedValue(1);
    asMock(mockPushDeliveryAttemptDb.createAndCount).mockResolvedValue(0);
    nativeContext.query.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        notificationId: index + 1,
      })),
    );
    asMock(mockNotificationDb.createAll).mockImplementation((data) =>
      nativeRows(
        data.map((item, index) =>
          databaseFixture("Notification", {
            ...NotificationBuilder.create(item.userId)
              .withId(index + 1)
              .build(),
            ...item,
          }),
        ),
      ),
    );
  });

  describe("DI 통합 테스트", () => {
    it("Notification endpoint UseCase와 발송 capability가 정상적으로 조립되어야 함", () => {
      // Given - DI 컨테이너가 구성됨

      // When - 파사드 인스턴스 확인

      // Then - 테스트 수직 경계가 정의되어 있어야 함
      expect(facade).toBeDefined();
      expect(facade.publish).toBeInstanceOf(Function);
      expect(facade.getNotifications).toBeInstanceOf(Function);
    });

    it("PrismaNotificationRepository가 정상적으로 주입되어야 함", () => {
      // Given - DI 컨테이너가 구성됨

      // When - 레포지토리 인스턴스 확인

      // Then - 레포지토리가 정의되어 있어야 함
      expect(repository).toBeDefined();
      expect(repository).toBeInstanceOf(PrismaNotificationRepository);
    });
  });

  describe("푸시 토큰 등록 통합 테스트", () => {
    it("새 푸시 토큰을 등록해야 함", async () => {
      // Given - 유효한 푸시 토큰 준비
      const mockToken = PushTokenBuilder.create(mockUserId)
        .withToken(mockPushToken)
        .asIos()
        .build();
      asMock(mockPushTokenDb.upsert).mockResolvedValue(databaseFixture("PushToken", mockToken));
      mockPushProvider.validateToken.mockReturnValue(true);

      // When - 푸시 토큰 등록 (파사드는 void 반환 — 등록 자체가 목적)
      await expect(
        facade.registerPushToken({
          userId: mockUserId,
          token: mockPushToken,
          platform: "IOS",
        }),
      ).resolves.toBeUndefined();

      // Then - upsert 수행 검증
      expect(mockPushTokenDb.upsert).toHaveBeenCalled();
    });

    it("유효하지 않은 토큰이면 예외를 발생시켜야 함", async () => {
      // Given - 유효하지 않은 토큰
      mockPushProvider.validateToken.mockReturnValue(false);

      // When & Then - 예외 발생 검증
      await expect(
        facade.registerPushToken({
          userId: mockUserId,
          token: "invalid-token",
          platform: "IOS",
        }),
      ).rejects.toMatchObject({ errorCode: "NOTIFICATION_1001" });
    });
  });

  describe("알림 목록 조회 통합 테스트", () => {
    it("알림 목록을 조회해야 함", async () => {
      // Given - 알림 목록 준비
      const mockNotifications = [
        NotificationBuilder.create(mockUserId).withId(1).asNudgeReceived("friend-1", 1).build(),
        NotificationBuilder.create(mockUserId).withId(2).asCheerReceived("friend-2", 1).build(),
      ];
      mockNotificationDb.all.mockReturnValue(
        nativeRows(databaseFixture("Notification", mockNotifications)),
      );
      asMock(mockNotificationDb.aggregate).mockResolvedValue({ count: 2 });

      // When - 알림 목록 조회
      const result = await facade.getNotifications({ userId: mockUserId });

      // Then - 목록 및 페이지네이션 검증
      expect(result.items).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(mockNotificationDb.all).toHaveBeenCalled();
    });

    it("읽지 않은 알림만 필터링해야 함", async () => {
      // Given - 읽지 않은 알림만 필터링
      const mockNotifications = [
        NotificationBuilder.create(mockUserId).withId(1).asUnread().build(),
      ];
      mockNotificationDb.all.mockReturnValue(
        nativeRows(databaseFixture("Notification", mockNotifications)),
      );
      asMock(mockNotificationDb.aggregate).mockResolvedValue({ count: 1 });

      // When - 읽지 않은 알림만 조회
      await facade.getNotifications({ userId: mockUserId, unreadOnly: true });

      // Then - 필터 조건 검증
      assertNativeWhereContains(
        "Notification",
        mockNotificationDb.where.mock.calls.at(-1)?.[0],
        (row) => and(row.userId.eq(mockUserId), row.isRead.eq(false)),
      );
    });

    it("category='SOCIAL'이면 소셜 타입 배열로 Repository를 호출해야 한다", async () => {
      // Given
      mockNotificationDb.all.mockReturnValue(nativeRows(databaseFixture("Notification", [])));

      // When
      await facade.getNotifications({
        userId: "user-1",
        category: "SOCIAL",
      });

      // Then
      assertNativeWhereContains(
        "Notification",
        mockNotificationDb.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.userId.eq("user-1"),
            row._type.in([
              "FOLLOW_NEW",
              "FOLLOW_ACCEPTED",
              "NUDGE_RECEIVED",
              "CHEER_RECEIVED",
              "FRIEND_COMPLETED",
              "SOCIAL_DIGEST",
              "NUDGE_SUGGEST",
            ]),
          ),
      );
    });

    it.each([undefined, "1.10.0", "1.10.1"])(
      "앱 버전 %s의 전체 목록은 구버전이 지원하는 알림만 페이지네이션한다",
      async (appVersion) => {
        // Given
        mockNotificationDb.all.mockReturnValue(nativeRows(databaseFixture("Notification", [])));

        // When
        await facade.getNotifications({
          userId: mockUserId,
          category: "ALL",
          appVersion,
        });

        // Then
        assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
          and(row.userId.eq(mockUserId), row._type.in(releasedNotificationTypes)),
        );
      },
    );

    it("1.11.0의 전체 목록은 신규 답장·고마움 알림도 조회한다", async () => {
      // Given
      mockNotificationDb.all.mockReturnValue(nativeRows(databaseFixture("Notification", [])));

      // When
      await facade.getNotifications({
        userId: "user-1",
        category: "ALL",
        appVersion: "1.11.0",
      });

      // Then
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls[0]?.[0], (row) =>
        row.userId.eq("user-1"),
      );
    });

    it("category와 unreadOnly를 함께 사용하면 두 조건 모두 전달해야 한다", async () => {
      // Given
      mockNotificationDb.all.mockReturnValue(nativeRows(databaseFixture("Notification", [])));

      // When
      await facade.getNotifications({
        userId: "user-1",
        category: "NOTICE",
        unreadOnly: true,
      });

      // Then
      assertNativeWhereContains(
        "Notification",
        mockNotificationDb.where.mock.calls.at(-1)?.[0],
        (row) =>
          and(
            row.userId.eq("user-1"),
            row.isRead.eq(false),
            row._type.in(["SYSTEM_NOTICE", "ADMIN_BROADCAST", "ADMIN_TARGETED"]),
          ),
      );
    });

    it("getNotifications + getUnreadCount 병렬 조회 시 두 결과 모두 정상 반환해야 한다", async () => {
      // Given
      const notifications = [
        NotificationBuilder.create(mockUserId).withId(1).asUnread().build(),
        NotificationBuilder.create(mockUserId).withId(2).asRead().build(),
      ];
      mockNotificationDb.all.mockReturnValue(
        nativeRows(databaseFixture("Notification", notifications)),
      );
      asMock(mockNotificationDb.aggregate).mockResolvedValue({ count: 1 });

      // When - Promise.all로 병렬 호출 (컨트롤러에서 하는 것과 동일)
      const [result, unreadCount] = await Promise.all([
        facade.getNotifications({ userId: mockUserId }),
        facade.getUnreadCount(mockUserId),
      ]);

      // Then
      expect(result.items).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(unreadCount).toBe(1);
      expect(mockNotificationDb.all).toHaveBeenCalled();
      expect(mockNotificationDb.aggregate).toHaveBeenCalled();
    });

    it("category + cursor 조합이 DB 쿼리에 함께 적용되어야 한다", async () => {
      // Given
      mockNotificationDb.all.mockReturnValue(nativeRows(databaseFixture("Notification", [])));

      // When
      asMock(mockNotificationDb.first).mockResolvedValue(
        databaseFixture("Notification", NotificationBuilder.create(mockUserId).withId(10).build()),
      );
      await facade.getNotifications({
        userId: mockUserId,
        category: "SOCIAL",
        cursor: 10,
        size: 5,
      });

      // Then
      assertNativeWhereContains(
        "Notification",
        mockNotificationDb.where.mock.calls[0]?.[0],
        (row) =>
          and(
            row.userId.eq(mockUserId),
            row._type.in([
              "FOLLOW_NEW",
              "FOLLOW_ACCEPTED",
              "NUDGE_RECEIVED",
              "CHEER_RECEIVED",
              "FRIEND_COMPLETED",
              "SOCIAL_DIGEST",
              "NUDGE_SUGGEST",
            ]),
          ),
      );
    });
  });

  describe("읽지 않은 알림 수 조회 통합 테스트", () => {
    it("구버전이 지원하는 읽지 않은 알림 수만 반환한다", async () => {
      // Given - 읽지 않은 알림 수 설정
      asMock(mockNotificationDb.aggregate).mockResolvedValue({ count: 5 });

      // When - 읽지 않은 알림 수 조회
      const result = await facade.getUnreadCount(mockUserId);

      // Then - 알림 수 검증
      expect(result).toBe(5);
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(
          row.userId.eq(mockUserId),
          row.isRead.eq(false),
          row._type.in(releasedNotificationTypes),
        ),
      );
    });

    it("1.11.0과 구버전의 읽지 않은 알림 수를 서로 다른 캐시 키로 조회한다", async () => {
      // Given
      asMock(mockNotificationDb.aggregate)
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 5 });
      const cacheService = module.get(CacheService);

      // When
      const releasedUnreadCount = await facade.getUnreadCount(mockUserId, "1.10.1");
      const currentUnreadCount = await facade.getUnreadCount(mockUserId, "1.11.0");

      // Then
      expect(releasedUnreadCount).toBe(3);
      expect(currentUnreadCount).toBe(5);
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.userId.eq(mockUserId), row.isRead.eq(false)),
      );
      expect(cacheService.wrap).toHaveBeenNthCalledWith(
        1,
        `aido:v1:notification:unread-count:${mockUserId}:legacy`,
        expect.any(Function),
        120_000,
      );
      expect(cacheService.wrap).toHaveBeenNthCalledWith(
        2,
        `aido:v1:notification:unread-count:${mockUserId}`,
        expect.any(Function),
        120_000,
      );
    });
  });

  describe("알림 읽음 처리 통합 테스트", () => {
    it("단일 알림을 읽음 처리해야 함", async () => {
      // Given - 읽음 처리할 알림 준비
      const mockNotification = NotificationBuilder.create(mockUserId)
        .withId(mockNotificationId)
        .asUnread()
        .build();
      asMock(mockNotificationDb.first).mockResolvedValue(
        databaseFixture("Notification", mockNotification),
      );
      asMock(mockNotificationDb.updateAndCount).mockResolvedValue(1);

      // When - 알림 읽음 처리
      await expect(facade.markAsRead(mockUserId, mockNotificationId)).resolves.toBeUndefined();

      // Then - 읽음 처리 검증
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.id.eq(mockNotificationId), row.userId.eq(mockUserId), row.isRead.eq(false)),
      );
      expect(mockNotificationDb.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Notification", {
            isRead: true,
          }),
        ),
      );
    });

    it("푸시 탭을 멱등 기록하고 읽음 상태로 맞춰야 함", async () => {
      asMock(mockNotificationDb.updateAndCount).mockResolvedValue(1);

      await expect(facade.markOpened(mockUserId, mockNotificationId)).resolves.toBe(true);

      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.id.eq(mockNotificationId), row.userId.eq(mockUserId), row.openedAt.isNull()),
      );
      expect(mockNotificationDb.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Notification", {
            isRead: true,
            openedAt: expect.any(String),
          }),
        ),
      );
      expect(mockPushDispatchDb.updateAndCount).toHaveBeenCalled();
    });

    it("서명 토큰으로 광고성 푸시 동의를 철회해야 함", async () => {
      asMock(mockUserConsentDb.upsert).mockResolvedValue(databaseFixture("UserConsent", {}));

      await expect(facade.optOutMarketingPush(`opt-out:${mockUserId}`)).resolves.toBe(true);

      assertNativeWhere("UserConsent", mockUserConsentDb.where.mock.calls.at(-1)?.[0], (row) =>
        row.userId.eq(mockUserId),
      );
    });

    it("존재하지 않는 알림이면 예외를 발생시켜야 함", async () => {
      // Given - 존재하지 않는 알림
      asMock(mockNotificationDb.first).mockResolvedValue(databaseFixture("Notification", null));

      // When & Then - 예외 발생 검증
      await expect(facade.markAsRead(mockUserId, 999)).rejects.toMatchObject({
        errorCode: "NOTIFICATION_1004",
      });
    });

    it("다른 사용자의 알림이면 예외를 발생시켜야 함", async () => {
      // Given - 다른 사용자의 알림
      const mockNotification = NotificationBuilder.create("other-user")
        .withId(mockNotificationId)
        .build();
      asMock(mockNotificationDb.first).mockResolvedValue(
        databaseFixture("Notification", mockNotification),
      );

      // When & Then - 예외 발생 검증
      await expect(facade.markAsRead(mockUserId, mockNotificationId)).rejects.toMatchObject({
        errorCode: "NOTIFICATION_1005",
      });
    });

    it("구버전에서 전체 읽음 처리해도 신규 답장·고마움 알림은 읽지 않는다", async () => {
      // Given - 전체 읽음 처리 준비
      asMock(mockNotificationDb.updateAndCount).mockResolvedValue(5);

      // When - 전체 알림 읽음 처리
      const result = await facade.markAllAsRead(mockUserId);

      // Then - 전체 읽음 처리 검증
      expect(result.count).toBe(5);
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(
          row.userId.eq(mockUserId),
          row.isRead.eq(false),
          row._type.in(releasedNotificationTypes),
        ),
      );
      expect(mockNotificationDb.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Notification", {
            isRead: true,
            readAt: expect.any(String),
          }),
        ),
      );
    });

    it("1.11.0은 신규 알림까지 전체 읽음 처리하고 두 버전의 캐시를 무효화한다", async () => {
      // Given
      asMock(mockNotificationDb.updateAndCount).mockResolvedValue(7);
      const cacheService = module.get(CacheService);

      // When
      const result = await facade.markAllAsRead(mockUserId, "1.11.0");

      // Then
      expect(result.count).toBe(7);
      assertNativeWhere("Notification", mockNotificationDb.where.mock.calls.at(-1)?.[0], (row) =>
        and(row.userId.eq(mockUserId), row.isRead.eq(false)),
      );
      expect(mockNotificationDb.updateAndCount).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Notification", { isRead: true, readAt: expect.any(String) }),
        ),
      );
      expect(cacheService.del).toHaveBeenCalledTimes(2);
      expect(cacheService.del).toHaveBeenCalledWith(
        `aido:v1:notification:unread-count:${mockUserId}`,
      );
      expect(cacheService.del).toHaveBeenCalledWith(
        `aido:v1:notification:unread-count:${mockUserId}:legacy`,
      );
    });
  });

  describe("알림 생성 및 발송 통합 테스트", () => {
    it("알림과 SINGLE delivery outbox를 같은 흐름에서 준비해야 함", async () => {
      // Given - 알림 및 푸시 토큰 준비
      const mockNotification = NotificationBuilder.create(mockUserId)
        .withId(mockNotificationId)
        .asNudgeReceived("friend-1", 1)
        .build();
      const mockToken = PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build();

      // UserPreference mock - pushEnabled가 true여야 푸시 발송
      asMock(mockUserPreferenceDb.first).mockResolvedValue(
        databaseFixture("UserPreference", {
          userId: mockUserId,
          pushEnabled: true,
          nightPushEnabled: true,
        }),
      );
      asMock(mockNotificationDb.create).mockResolvedValue(
        databaseFixture("Notification", mockNotification),
      );
      mockPushTokenDb.all.mockReturnValue(nativeRows(databaseFixture("PushToken", [mockToken])));
      mockPushProvider.sendBatch.mockResolvedValue({
        successful: [{ token: mockPushToken }],
        failed: [],
      });

      // When - 알림 생성 및 발송
      const result = await facade.publish({
        userId: mockUserId,
        type: "NUDGE_RECEIVED",
        title: "테스트 알림",
        body: "테스트 알림 내용입니다",
      });

      // Then - 알림 생성과 durable delivery staging 검증
      expect(result).toEqual(mockNotification);
      expect(mockNotificationDb.create).toHaveBeenCalled();
      expect(mockPushDispatchStaging.stage).toHaveBeenCalledWith({
        notificationId: mockNotification.id,
        userId: mockUserId,
        purpose: "TRANSACTIONAL",
        campaignKey: undefined,
        variantId: undefined,
        deliveryMode: "SINGLE",
        force: false,
      });
      expect(mockAfterCommitPublisher.register).toHaveBeenCalledWith([mockNotification.id]);
    });

    it("푸시 토큰이 없어도 알림을 생성해야 함", async () => {
      // Given - 푸시 토큰 없음
      const mockNotification = NotificationBuilder.create(mockUserId)
        .withId(mockNotificationId)
        .asNudgeReceived("friend-1", 1)
        .build();

      asMock(mockNotificationDb.create).mockResolvedValue(
        databaseFixture("Notification", mockNotification),
      );
      mockPushTokenDb.all.mockReturnValue(nativeRows(databaseFixture("PushToken", [])));

      // When - 알림 생성 (푸시 토큰 없음)
      const result = await facade.publish({
        userId: mockUserId,
        type: "NUDGE_RECEIVED",
        title: "테스트 알림",
        body: "테스트 알림 내용입니다",
      });

      // Then - 알림 생성만 수행됨
      expect(result).toEqual(mockNotification);
      expect(mockPushProvider.sendBatch).not.toHaveBeenCalled();
    });

    it("MORNING_REMINDER publishBatch 시 title에 {count}가 치환된 값이 저장되어야 함", async () => {
      // Given - morningReminder 템플릿으로 치환된 메시지 준비
      const todoCount = 3;
      const message = createMorningReminderNotificationMessage({ count: todoCount });

      const dataList = [
        {
          userId: mockUserId,
          type: "MORNING_REMINDER" as const,
          title: message.title,
          body: message.body,
        },
      ];

      mockUserPreferenceDb.all.mockReturnValue(
        nativeRows(
          databaseFixture(
            "UserPreference",
            [{ userId: mockUserId, pushEnabled: true, nightPushEnabled: true }].map((value) => ({
              ...UserPreferenceBuilder.create(value.userId).build(),
              ...value,
            })),
          ),
        ),
      );
      mockUserConsentDb.all.mockReturnValue(nativeRows(databaseFixture("UserConsent", [])));
      mockPushTokenDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("PushToken", [
            PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
          ]),
        ),
      );
      mockPushProvider.sendBatch.mockResolvedValue({
        total: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ token: mockPushToken, success: true }],
        invalidTokens: [],
      });

      // When - 배치 알림 생성 및 발송
      const result = await facade.publishBatch(dataList);

      // Then - title이 치환된 값이어야 하며, {count}가 포함되지 않아야 함
      expect(result.count).toBe(1);
      expect(message.title).toContain("3");
      expect(message.title).not.toContain("{count}");

      const createManyCall = mockNotificationDb.createAll.mock.calls[0]?.[0];
      expect(createManyCall?.[0]?.title).toBe(message.title);
      expect(createManyCall?.[0]?.title).not.toContain("{count}");
      expect(createManyCall?.[0]?._type).toBe("MORNING_REMINDER");
    });

    it("할일 없는 사용자에게 MORNING_NO_TODO 메시지로 알림이 정상 생성되어야 함", async () => {
      // Given - morningNoTodo 템플릿 메시지 준비
      const message = createMorningNoTodoNotificationMessage();
      const mockNotification = NotificationBuilder.create(mockUserId)
        .withId(10)
        .withType("MORNING_REMINDER")
        .withContent(message.title, message.body)
        .build();

      asMock(mockNotificationDb.create).mockResolvedValue(
        databaseFixture("Notification", mockNotification),
      );
      asMock(mockUserPreferenceDb.first).mockResolvedValue(
        databaseFixture("UserPreference", {
          userId: mockUserId,
          pushEnabled: true,
          nightPushEnabled: true,
        }),
      );
      mockPushTokenDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("PushToken", [
            PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
          ]),
        ),
      );
      mockPushProvider.sendBatch.mockResolvedValue({
        total: 1,
        successCount: 1,
        failureCount: 0,
        invalidTokens: [],
      });

      // When - 할일 없는 사용자용 알림 생성
      const result = await facade.publish({
        userId: mockUserId,
        type: "MORNING_REMINDER",
        title: message.title,
        body: message.body,
      });

      // Then - morningNoTodo 메시지가 그대로 저장되어야 함
      expect(result).not.toBeNull();
      expect(result?.title).toBe(message.title);
      expect(result?.body).toBe(message.body);
      expect(result?.type).toBe("MORNING_REMINDER");
      expect(mockNotificationDb.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("Notification", {
            userId: mockUserId,
            type: "MORNING_REMINDER",
            title: message.title,
            body: message.body,
          }),
        ),
      );
    });

    it("publishBatch에서 할일 있는 사용자와 없는 사용자 알림이 함께 저장되어야 함", async () => {
      // Given - 할일 있는 사용자와 없는 사용자 메시지 준비
      const userWithTodos = "user-with-todos";
      const userWithoutTodos = "user-without-todos";

      const messageWithTodos = createMorningReminderNotificationMessage({ count: 5 });
      const messageNoTodos = createMorningNoTodoNotificationMessage();

      const dataList = [
        {
          userId: userWithTodos,
          type: "MORNING_REMINDER" as const,
          title: messageWithTodos.title,
          body: messageWithTodos.body,
        },
        {
          userId: userWithoutTodos,
          type: "MORNING_REMINDER" as const,
          title: messageNoTodos.title,
          body: messageNoTodos.body,
        },
      ];

      mockUserPreferenceDb.all.mockReturnValue(
        nativeRows(
          databaseFixture(
            "UserPreference",
            [
              { userId: userWithTodos, pushEnabled: true, nightPushEnabled: true },
              { userId: userWithoutTodos, pushEnabled: true, nightPushEnabled: true },
            ].map((value) => ({ ...UserPreferenceBuilder.create(value.userId).build(), ...value })),
          ),
        ),
      );
      mockUserConsentDb.all.mockReturnValue(nativeRows(databaseFixture("UserConsent", [])));
      mockPushTokenDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("PushToken", [
            PushTokenBuilder.create(userWithTodos).withToken("token-1").build(),
            PushTokenBuilder.create(userWithoutTodos).withToken("token-2").build(),
          ]),
        ),
      );
      mockPushProvider.sendBatch.mockResolvedValue({
        total: 2,
        successCount: 2,
        failureCount: 0,
        results: [
          { token: "token-1", success: true },
          { token: "token-2", success: true },
        ],
        invalidTokens: [],
      });

      // When - 배치 알림 생성 및 발송
      const result = await facade.publishBatch(dataList);

      // Then - 두 사용자 모두 알림이 생성되어야 함
      expect(result.count).toBe(2);

      const createManyCall = mockNotificationDb.createAll.mock.calls[0]?.[0];
      // 할일 있는 사용자: 치환된 title
      expect(createManyCall?.[0]?.title).toBe(messageWithTodos.title);
      expect(createManyCall?.[0]?.title).not.toContain("{count}");
      // 할일 없는 사용자: morningNoTodo 메시지
      expect(createManyCall?.[1]?.title).toBe(messageNoTodos.title);
      expect(createManyCall?.[1]?.body).toBe(messageNoTodos.body);
    });

    it("force 항목은 BATCH delivery outbox에 손실 없이 저장되어야 함", async () => {
      // Given - 푸시를 꺼둔 사용자와 force 지정된 관리자 브로드캐스트
      const dataList = [
        {
          userId: mockUserId,
          type: "ADMIN_BROADCAST" as const,
          title: "중요 공지",
          body: "강제 발송 본문",
          force: true,
          action: {
            type: "BROWSER" as const,
            url: "https://aido.kr/ko/patch-notes",
          },
        },
      ];

      mockUserPreferenceDb.all.mockReturnValue(
        nativeRows(
          databaseFixture(
            "UserPreference",
            [{ userId: mockUserId, pushEnabled: false, nightPushEnabled: false }].map((value) => ({
              ...UserPreferenceBuilder.create(value.userId).build(),
              ...value,
            })),
          ),
        ),
      );
      mockUserConsentDb.all.mockReturnValue(nativeRows(databaseFixture("UserConsent", [])));
      mockPushTokenDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("PushToken", [
            PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
          ]),
        ),
      );
      mockPushProvider.sendBatch.mockResolvedValue({
        total: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ token: mockPushToken, success: true }],
        invalidTokens: [],
      });

      // When - 배치 알림 생성 및 발송 (재조립 경로 포함 end-to-end)
      const result = await facade.publishBatch(dataList);

      // Then - crash 뒤 worker가 같은 정책을 재현할 수 있도록 force가 staging됨
      expect(result.count).toBe(1);
      expect(mockPushDispatchStaging.stageMany).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: mockUserId,
          deliveryMode: "BATCH",
          force: true,
        }),
      ]);
    });

    it("같은 사용자 배치에서도 각 outbox의 force 값을 독립적으로 보존해야 함", async () => {
      // Given - 푸시를 꺼둔 사용자에게 force 알림과 일반 알림이 한 배치로 들어올 때
      const dataList = [
        {
          userId: mockUserId,
          type: "ADMIN_TARGETED" as const,
          title: "중요 공지",
          body: "강제 발송 본문",
          force: true,
        },
        {
          userId: mockUserId,
          type: "TODO_REMINDER" as const,
          title: "할 일 리마인더",
          body: "일반 발송 본문",
        },
      ];

      mockUserPreferenceDb.all.mockReturnValue(
        nativeRows(
          databaseFixture(
            "UserPreference",
            [{ userId: mockUserId, pushEnabled: false, nightPushEnabled: false }].map((value) => ({
              ...UserPreferenceBuilder.create(value.userId).build(),
              ...value,
            })),
          ),
        ),
      );
      mockUserConsentDb.all.mockReturnValue(nativeRows(databaseFixture("UserConsent", [])));
      mockPushTokenDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("PushToken", [
            PushTokenBuilder.create(mockUserId).withToken(mockPushToken).build(),
          ]),
        ),
      );
      mockPushProvider.sendBatch.mockResolvedValue({
        total: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ token: mockPushToken, success: true }],
        invalidTokens: [],
      });

      // When - 배치 알림 생성 및 발송
      const result = await facade.publishBatch(dataList);

      // Then - worker가 각 dispatch 정책을 독립적으로 적용할 수 있음
      expect(result.count).toBe(2);
      expect(mockPushDispatchStaging.stageMany).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: mockUserId,
          deliveryMode: "BATCH",
          force: true,
        }),
        expect.objectContaining({
          userId: mockUserId,
          deliveryMode: "BATCH",
          force: false,
        }),
      ]);
    });
  });
});
