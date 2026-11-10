import { TransactionHost } from "@nestjs-cls/transactional";
import { Test, type TestingModule } from "@nestjs/testing";
import { and, eq } from "drizzle-orm";
import { vi } from "vitest";

import {
  UserPreferenceReaderPort,
  UserSettingsCachePort,
} from "#api/modules/identity/identity-settings.public";
import { ReadUserPreferencesUseCase } from "#api/modules/identity/preferences/application/use-cases/read-user-preferences.use-case";
import { UserSettingsCacheAdapter } from "#api/modules/identity/preferences/infrastructure/adapters/user-settings-cache.adapter";
import { DrizzleUserConsentRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-consent.repository";
import { DrizzleUserPreferenceRepository } from "#api/modules/identity/preferences/infrastructure/persistence/drizzle-user-preference.repository";
import { NotificationRepositoryPort } from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import type { InboxNotification } from "#api/modules/notification/inbox/application/read-models/inbox-notification.read-model";
import { GetUnreadNotificationCountUseCase } from "#api/modules/notification/inbox/application/use-cases/get-unread-notification-count.use-case";
import { ListNotificationsUseCase } from "#api/modules/notification/inbox/application/use-cases/list-notifications.use-case";
import { MarkAllNotificationsReadUseCase } from "#api/modules/notification/inbox/application/use-cases/mark-all-notifications-read.use-case";
import { MarkNotificationOpenedUseCase } from "#api/modules/notification/inbox/application/use-cases/mark-notification-opened.use-case";
import { MarkNotificationReadUseCase } from "#api/modules/notification/inbox/application/use-cases/mark-notification-read.use-case";
import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { NOTIFICATION_INBOX_PROVIDERS } from "#api/modules/notification/inbox/notification-inbox.providers";
import { PublishNotificationUseCase } from "#api/modules/notification/notification-delivery.public";
import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
} from "#api/modules/notification/push/application/messages/notification.messages";
import { MarketingConsentReconfirmPort } from "#api/modules/notification/push/application/ports/marketing-consent-reconfirm.port";
import { MarketingPushOptOutTokenPort } from "#api/modules/notification/push/application/ports/marketing-push-opt-out-token.port";
import { NotificationDedupPort } from "#api/modules/notification/push/application/ports/notification-dedup.port";
import { PushDeliveryJobEnqueuerPort } from "#api/modules/notification/push/application/ports/push-delivery-job-enqueuer.port";
import { PushDispatchStagingRepositoryPort } from "#api/modules/notification/push/application/ports/push-dispatch-staging.repository.port";
import { PushProviderPort } from "#api/modules/notification/push/application/ports/push-provider.port";
import { PushRateLimiterPort } from "#api/modules/notification/push/application/ports/push-rate-limiter.port";
import { UserNotificationSettingsPort } from "#api/modules/notification/push/application/ports/user-notification-settings.port";
import { OptOutMarketingPushUseCase } from "#api/modules/notification/push/application/use-cases/opt-out-marketing-push.use-case";
import { PublishPushDeliveryAfterCommitUseCase } from "#api/modules/notification/push/application/use-cases/publish-push-delivery-after-commit.use-case";
import { ReportPushDeviceUseCase } from "#api/modules/notification/push/application/use-cases/report-push-device.use-case";
import { SendBatchNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-batch-notification.use-case";
import { SendNotificationWithDedupUseCase } from "#api/modules/notification/push/application/use-cases/send-notification-with-dedup.use-case";
import { SendNotificationUseCase } from "#api/modules/notification/push/application/use-cases/send-notification.use-case";
import {
  NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS,
  NOTIFICATION_PUSH_USE_CASE_PROVIDERS,
} from "#api/modules/notification/push/notification-push.providers";
import { CacheService } from "#api/platform/cache/cache.service";
import {
  notification,
  pushDispatch,
  pushToken,
  userConsent,
  userPreference,
  user as userTable,
} from "#api/platform/database/schema/index";
import { DEDUP_PROVIDER } from "#api/platform/dedup/interfaces/dedup.interface";
import { LOCK_PROVIDER } from "#api/platform/lock/interfaces/lock.interface";
import { paginationServiceProvider } from "#api/platform/pagination/pagination.providers";
import { SystemClock } from "#api/platform/time/system-clock";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  AfterCommitTaskRegistryPort,
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { UserPreferenceBuilder } from "#test/builders/index";
import { NoCacheStore } from "#test/doubles/platform/no-cache-store";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";
import { createReportPushDeviceCommandFixture } from "#test/fixtures/notification/push-device.fixture";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { suppressLogger } from "#test/setup/suppress-logger";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";
import type { UserPreference } from "#test/types/database-rows";

function buildNotificationTestApi(module: TestingModule) {
  const publisher = new PublishNotificationUseCase({
    sendNotification: module.get(SendNotificationUseCase),
    sendNotificationWithDeduplication: module.get(SendNotificationWithDedupUseCase),
    sendBatchNotification: module.get(SendBatchNotificationUseCase),
    todoTargetReader: { findTodoTargets: () => Promise.resolve(new Map()) },
  });
  const getNotificationsUseCase = module.get(ListNotificationsUseCase);
  const getUnreadCountUseCase = module.get(GetUnreadNotificationCountUseCase);
  const markAsReadUseCase = module.get(MarkNotificationReadUseCase);
  const markNotificationOpenedUseCase = module.get(MarkNotificationOpenedUseCase);
  const markAllAsReadUseCase = module.get(MarkAllNotificationsReadUseCase);
  const reportPushDeviceUseCase = module.get(ReportPushDeviceUseCase);
  const optOutMarketingPushUseCase = module.get(OptOutMarketingPushUseCase);

  return {
    publish: publisher.publish.bind(publisher),
    publishWithDeduplication: publisher.publishWithDeduplication.bind(publisher),
    publishBatch: publisher.publishBatch.bind(publisher),
    reportPushDevice: reportPushDeviceUseCase.execute.bind(reportPushDeviceUseCase),
    getNotifications: getNotificationsUseCase.execute.bind(getNotificationsUseCase),
    getUnreadCount: (userId: string, appVersion?: string) =>
      getUnreadCountUseCase.execute({ userId, appVersion }),
    markAsRead: (userId: string, notificationId: number) =>
      markAsReadUseCase.execute({ userId, notificationId }),
    markOpened: (userId: string, notificationId: number) =>
      markNotificationOpenedUseCase.execute({ userId, notificationId }),
    markAllAsRead: (userId: string, appVersion?: string) =>
      markAllAsReadUseCase.execute({ userId, appVersion }),
    optOutMarketingPush: optOutMarketingPushUseCase.execute.bind(optOutMarketingPushUseCase),
  };
}

const GRANTED_PERMISSION = { status: "GRANTED", canAskAgain: false } as const;

describe("Notification 통합 테스트 (실제 PostgreSQL)", () => {
  let module: TestingModule;
  let facade: ReturnType<typeof buildNotificationTestApi>;
  let repository: NotificationRepositoryPort;
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;
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
  const mockUserId = "user-notification-123";
  const mockPushToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  beforeAll(async () => {
    suppressLogger();
    testDatabase = new TestDatabase();
    client = await testDatabase.start();
    const transaction = createDatabaseTransactionFixture(client);

    module = await Test.createTestingModule({
      providers: [
        ...NOTIFICATION_INBOX_PROVIDERS,
        { provide: ClockPort, useClass: SystemClock },
        { provide: OperationalAlertPort, useValue: new RecordingOperationalAlert() },
        ...NOTIFICATION_PUSH_PERSISTENCE_PROVIDERS,
        ...NOTIFICATION_PUSH_USE_CASE_PROVIDERS,
        {
          provide: PushDispatchStagingRepositoryPort,
          useValue: mockPushDispatchStaging,
        },
        // 이 테스트는 outbox 발행을 막아 두고 알림 행·토큰 저장만 본다
        { provide: PushDeliveryJobEnqueuerPort, useValue: { enqueueDeliveries: vi.fn() } },
        {
          provide: MarketingConsentReconfirmPort,
          useValue: { findMarketingReconfirmTargets: vi.fn(), claimMarketingReconfirm: vi.fn() },
        },
        {
          provide: UNIT_OF_WORK,
          useValue: transaction.uow satisfies UnitOfWorkPort,
        },
        { provide: UnitOfWorkPort, useExisting: UNIT_OF_WORK },
        {
          provide: AFTER_COMMIT_TASK_REGISTRY,
          useValue: {
            register: (task) => {
              task().catch(() => undefined);
            },
          } satisfies AfterCommitTaskRegistryPort,
        },
        { provide: AfterCommitTaskRegistryPort, useExisting: AFTER_COMMIT_TASK_REGISTRY },
        {
          provide: PublishPushDeliveryAfterCommitUseCase,
          useValue: mockAfterCommitPublisher,
        },
        {
          provide: UserPreferenceReaderPort,
          useFactory: (
            preferenceRepository: DrizzleUserPreferenceRepository,
            cache: CacheService,
          ) =>
            new ReadUserPreferencesUseCase({
              preferenceRepository,
              cache: new UserSettingsCacheAdapter(cache),
            }),
          inject: [DrizzleUserPreferenceRepository, CacheService],
        },
        UserSettingsCacheAdapter,
        { provide: UserSettingsCachePort, useExisting: UserSettingsCacheAdapter },
        {
          provide: NotificationDedupPort,
          useValue: {
            recordNotifiedUsers: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MarketingPushOptOutTokenPort,
          useValue: mockMarketingPushOptOutToken,
        },
        paginationServiceProvider,
        DrizzleUserPreferenceRepository,
        DrizzleUserConsentRepository,
        {
          provide: UserNotificationSettingsPort,
          useFactory: (
            preferenceRepository: DrizzleUserPreferenceRepository,
            consentRepository: DrizzleUserConsentRepository,
          ) => ({
            upsertPushTimezone: (userId: UserId, timezone: string) =>
              preferenceRepository.upsertTimezone(userId, timezone),
            upsertPushLocale: (userId: UserId, locale: string) =>
              preferenceRepository.upsertLocale(userId, locale),
            getPreferenceRecord: (userId: UserId) => preferenceRepository.findByUserId(userId),
            getPreferenceRecordsByUserIds: (userIds: readonly UserId[]) =>
              preferenceRepository.findByUserIds(userIds),
            getConsentRecord: (userId: UserId) => consentRepository.findByUserId(userId),
            getConsentRecordsByUserIds: (userIds: readonly UserId[]) =>
              consentRepository.findByUserIds(userIds),
            updateMarketingPushConsent: (userId: UserId, agreed: boolean) =>
              consentRepository
                .upsertMarketingPushConsent(userId, {
                  agreedAt: agreed ? Temporal.Instant.fromEpochMilliseconds(Date.now()) : null,
                })
                .then(() => undefined),
          }),
          inject: [DrizzleUserPreferenceRepository, DrizzleUserConsentRepository],
        },
        {
          provide: TransactionHost,
          useValue: transaction.txHost,
        },
        {
          provide: PushProviderPort,
          useValue: mockPushProvider,
        },
        { provide: NoCacheStore, useValue: new NoCacheStore() },
        {
          provide: CacheService,
          inject: [NoCacheStore],
          useFactory: (store: NoCacheStore) => new CacheService(store),
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
          provide: PushRateLimiterPort,
          useValue: {
            reserveGeneral: vi.fn().mockResolvedValue(false),
            reserveEngagement: vi.fn().mockResolvedValue(false),
            reserveBatch: vi
              .fn()
              .mockImplementation(async (requests: unknown[]) => requests.map(() => false)),
          },
        },
      ],
    }).compile();

    facade = buildNotificationTestApi(module);
    repository = module.get(NotificationRepositoryPort);
  });

  afterAll(async () => {
    await module.close();
    await testDatabase.stop();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await testDatabase.cleanup();
    await client.insert(userTable).values(
      [
        mockUserId,
        "friend-1",
        "friend-2",
        "user-1",
        "other-user",
        "user-with-todos",
        "user-without-todos",
      ].map((id, index) => ({
        id,
        email: `notification-${index}@example.com`,
        userTag: `NOTIF${String(index).padStart(3, "0")}`,
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      })),
    );
  });

  async function seedNotifications(rows: InboxNotification[]) {
    const inserted = [];
    for (const row of rows) {
      const { id: _id, ...values } = row;
      const [created] = await client.insert(notification).values(values).returning();
      if (created === undefined) {
        throw new Error("notification fixture was not created");
      }
      inserted.push(created);
    }
    return inserted;
  }

  async function seedPushToken(userId: string, token: string) {
    const { id: _id, ...values } = createPushTokenFixture({
      userId,
      token,
      deviceId: `device-${token}`,
    });
    await client.insert(pushToken).values(values);
  }

  async function seedPreference(userId: string, overrides: Partial<UserPreference>) {
    const { id: _id, ...values } = UserPreferenceBuilder.create(userId).build();
    await client.insert(userPreference).values({ ...values, ...overrides });
  }

  async function findNotification(id: number) {
    return client.query.notification.findFirst({ where: { id } });
  }

  describe("DI 통합 테스트", () => {
    it("Notification endpoint UseCase와 발송 capability가 정상적으로 조립되어야 함", () => {
      // Given
      const assembled = facade;

      // When
      const { publish, getNotifications } = assembled;

      // Then
      expect(assembled).toBeDefined();
      expect(publish).toBeInstanceOf(Function);
      expect(getNotifications).toBeInstanceOf(Function);
    });

    it("DrizzleNotificationRepository가 정상적으로 주입되어야 함", () => {
      // Given
      const injected = repository;

      // When
      const isRepository = injected instanceof DrizzleNotificationRepository;

      // Then
      expect(injected).toBeDefined();
      expect(isRepository).toBe(true);
    });
  });

  describe("푸시 기기 보고 통합 테스트", () => {
    it("새 푸시 토큰을 등록해야 함", async () => {
      // Given
      mockPushProvider.validateToken.mockReturnValue(true);

      // When
      const registration = facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          deviceId: "ios_device-1",
          token: mockPushToken,
        }),
      );

      // Then
      await expect(registration).resolves.toMatchObject({ hasActiveToken: true });
      expect(
        await client.query.pushToken.findFirst({
          where: { userId: mockUserId, token: mockPushToken },
        }),
      ).toMatchObject({ platform: "IOS", isActive: true });
    });

    it("같은 사용자·기기가 다시 등록하면 한 행을 갱신한다", async () => {
      // Given
      mockPushProvider.validateToken.mockReturnValue(true);
      await facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          token: mockPushToken,
          deviceId: "ios_device-1",
          appVersion: "1.13.0",
        }),
      );

      // When
      await facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          token: mockPushToken,
          deviceId: "ios_device-1",
          appVersion: "1.14.0",
        }),
      );

      // Then
      const rows = await client.query.pushToken.findMany({ where: { token: mockPushToken } });
      expect(rows).toEqual([
        expect.objectContaining({
          userId: mockUserId,
          deviceId: "ios_device-1",
          appVersion: "1.14.0",
        }),
      ]);
    });

    it("이전 사용자의 해제가 실패한 기기에 다른 사용자가 등록하면 토큰 소유가 새 사용자로 옮겨진다", async () => {
      // Given 사용자 A가 등록한 기기에서 A의 해제 요청이 서버에 닿지 않았다
      mockPushProvider.validateToken.mockReturnValue(true);
      await facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          token: mockPushToken,
          deviceId: "ios_device-1",
        }),
      );

      // When 같은 기기에서 사용자 B가 로그인해 같은 토큰을 등록한다
      const registration = facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: "other-user",
          token: mockPushToken,
          deviceId: "ios_device-1",
        }),
      );

      // Then
      await expect(registration).resolves.toMatchObject({ hasActiveToken: true });
      const rows = await client.query.pushToken.findMany({ where: { token: mockPushToken } });
      expect(rows).toEqual([
        expect.objectContaining({ userId: "other-user", deviceId: "ios_device-1", isActive: true }),
      ]);
      expect(await client.query.pushToken.findMany({ where: { userId: mockUserId } })).toEqual([]);
    });

    it("같은 사용자의 deviceId가 바뀌어도 같은 토큰은 새 기기 행 하나만 남는다", async () => {
      // Given
      mockPushProvider.validateToken.mockReturnValue(true);
      await facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          token: mockPushToken,
          deviceId: "ios_device-old",
        }),
      );

      // When
      await facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          token: mockPushToken,
          deviceId: "ios_device-new",
        }),
      );

      // Then
      const rows = await client.query.pushToken.findMany({ where: { token: mockPushToken } });
      expect(rows).toEqual([expect.objectContaining({ deviceId: "ios_device-new" })]);
    });

    it("유효하지 않은 토큰이면 예외를 발생시켜야 함", async () => {
      // Given
      mockPushProvider.validateToken.mockReturnValue(false);

      // When
      const registration = facade.reportPushDevice(
        createReportPushDeviceCommandFixture({
          permission: GRANTED_PERMISSION,
          payloadVersion: 1,
          userId: mockUserId,
          deviceId: "ios_device-1",
          token: "invalid-token",
        }),
      );

      // Then
      await expect(registration).rejects.toMatchObject({ errorCode: "NOTIFICATION_1001" });
      expect(await client.$count(pushToken)).toBe(0);
    });
  });

  describe("알림 목록 조회 통합 테스트", () => {
    it("알림 목록을 조회해야 함", async () => {
      // Given
      await seedNotifications([
        createInboxNotificationFixture({
          userId: mockUserId,
          type: "NUDGE_RECEIVED",
          friendId: "friend-1",
          nudgeId: 1,
          title: "콕 찌르기!",
          body: "친구가 당신을 찔렀어요",
        }),
        createInboxNotificationFixture({
          userId: mockUserId,
          type: "CHEER_RECEIVED",
          friendId: "friend-2",
          cheerId: 1,
          title: "응원 메시지!",
          body: "친구가 응원을 보냈어요",
        }),
      ]);

      // When
      const result = await facade.getNotifications({ userId: mockUserId });

      // Then
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });

    it("읽지 않은 알림만 필터링해야 함", async () => {
      // Given
      const [unread] = await seedNotifications([
        createInboxNotificationFixture({ userId: mockUserId, isRead: false, readAt: null }),
        createInboxNotificationFixture({
          userId: mockUserId,
          isRead: true,
          readAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
        }),
      ]);

      // When
      const result = await facade.getNotifications({ userId: mockUserId, unreadOnly: true });

      // Then
      expect(result.items.map((item) => item.id)).toEqual([unread?.id]);
    });

    it("category='SOCIAL'이면 소셜 타입 알림만 조회해야 한다", async () => {
      // Given
      await seedNotifications([
        createInboxNotificationFixture({ userId: "user-1", type: "FOLLOW_NEW" }),
        createInboxNotificationFixture({ userId: "user-1", type: "CHEER_RECEIVED" }),
        createInboxNotificationFixture({ userId: "user-1", type: "SYSTEM_NOTICE" }),
        createInboxNotificationFixture({ userId: "user-1", type: "TODO_REMINDER" }),
        createInboxNotificationFixture({ userId: "other-user", type: "FOLLOW_NEW" }),
      ]);

      // When
      const result = await facade.getNotifications({ userId: "user-1", category: "SOCIAL" });

      // Then
      expect(result.items.map((item) => item.type).sort()).toEqual([
        "CHEER_RECEIVED",
        "FOLLOW_NEW",
      ]);
    });

    it.each([undefined, "1.10.0", "1.10.1"])(
      "앱 버전 %s의 전체 목록은 구버전이 지원하는 알림만 페이지네이션한다",
      async (appVersion) => {
        // Given
        await seedNotifications([
          createInboxNotificationFixture({ userId: mockUserId, type: "FOLLOW_NEW" }),
          createInboxNotificationFixture({ userId: mockUserId, type: "NUDGE_REPLIED" }),
          createInboxNotificationFixture({ userId: mockUserId, type: "INVITE_JOINED" }),
        ]);

        // When
        const result = await facade.getNotifications({
          userId: mockUserId,
          category: "ALL",
          appVersion,
        });

        // Then
        expect(result.items.map((item) => item.type)).toEqual(["FOLLOW_NEW"]);
      },
    );

    it("1.13.0의 전체 목록은 모든 알림 타입을 조회한다", async () => {
      // Given
      await seedNotifications([
        createInboxNotificationFixture({ userId: "user-1", type: "FOLLOW_NEW" }),
        createInboxNotificationFixture({ userId: "user-1", type: "NUDGE_REPLIED" }),
        createInboxNotificationFixture({ userId: "user-1", type: "INVITE_JOINED" }),
      ]);

      // When
      const result = await facade.getNotifications({
        userId: "user-1",
        category: "ALL",
        appVersion: "1.13.0",
      });

      // Then
      expect(result.items.map((item) => item.type).sort()).toEqual([
        "FOLLOW_NEW",
        "INVITE_JOINED",
        "NUDGE_REPLIED",
      ]);
    });

    it("category와 unreadOnly를 함께 사용하면 두 조건을 모두 적용해야 한다", async () => {
      // Given
      const [match] = await seedNotifications([
        createInboxNotificationFixture({
          userId: "user-1",
          type: "SYSTEM_NOTICE",
          isRead: false,
          readAt: null,
        }),
        createInboxNotificationFixture({
          userId: "user-1",
          type: "SYSTEM_NOTICE",
          isRead: true,
          readAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
        }),
        createInboxNotificationFixture({
          userId: "user-1",
          type: "FOLLOW_NEW",
          isRead: false,
          readAt: null,
        }),
      ]);

      // When
      const result = await facade.getNotifications({
        userId: "user-1",
        category: "NOTICE",
        unreadOnly: true,
      });

      // Then
      expect(result.items.map((item) => item.id)).toEqual([match?.id]);
    });

    it("getNotifications + getUnreadCount 병렬 조회 시 두 결과 모두 정상 반환해야 한다", async () => {
      // Given
      await seedNotifications([
        createInboxNotificationFixture({ userId: mockUserId, isRead: false, readAt: null }),
        createInboxNotificationFixture({
          userId: mockUserId,
          isRead: true,
          readAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
        }),
      ]);

      // When
      const [result, unreadCount] = await Promise.all([
        facade.getNotifications({ userId: mockUserId }),
        facade.getUnreadCount(mockUserId),
      ]);

      // Then
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
      expect(unreadCount).toBe(1);
    });

    it("category + cursor 조합이 DB 쿼리에 함께 적용되어야 한다", async () => {
      // Given
      const rows = await seedNotifications([
        createInboxNotificationFixture({ userId: mockUserId, type: "FOLLOW_NEW" }),
        createInboxNotificationFixture({ userId: mockUserId, type: "CHEER_RECEIVED" }),
        createInboxNotificationFixture({ userId: mockUserId, type: "SYSTEM_NOTICE" }),
        createInboxNotificationFixture({ userId: mockUserId, type: "FOLLOW_ACCEPTED" }),
      ]);
      const cursor = rows[3]?.id;

      // When
      const result = await facade.getNotifications({
        userId: mockUserId,
        category: "SOCIAL",
        cursor,
        size: 5,
      });

      // Then
      expect(result.items.map((item) => item.id)).toEqual([rows[1]?.id, rows[0]?.id]);
    });
  });

  describe("읽지 않은 알림 수 조회 통합 테스트", () => {
    it("구버전이 지원하는 읽지 않은 알림 수만 반환한다", async () => {
      // Given
      await seedNotifications([
        ...Array.from({ length: 5 }, () => createInboxNotificationFixture({ userId: mockUserId })),
        createInboxNotificationFixture({ userId: mockUserId, type: "NUDGE_REPLIED" }),
        createInboxNotificationFixture({
          userId: mockUserId,
          isRead: true,
          readAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
        }),
      ]);

      // When
      const result = await facade.getUnreadCount(mockUserId);

      // Then
      expect(result).toBe(5);
    });

    it("1.13.0과 구버전의 읽지 않은 알림 수를 서로 다른 캐시 키로 조회한다", async () => {
      // Given
      await seedNotifications([
        ...Array.from({ length: 3 }, () => createInboxNotificationFixture({ userId: mockUserId })),
        ...Array.from({ length: 2 }, () =>
          createInboxNotificationFixture({ userId: mockUserId, type: "INVITE_JOINED" }),
        ),
      ]);
      const cacheStore = module.get(NoCacheStore);
      cacheStore.forgetRecords();

      // When
      const releasedUnreadCount = await facade.getUnreadCount(mockUserId, "1.10.1");
      const currentUnreadCount = await facade.getUnreadCount(mockUserId, "1.13.0");

      // Then
      expect(releasedUnreadCount).toBe(3);
      expect(currentUnreadCount).toBe(5);
      expect(cacheStore.wrapped).toEqual([
        { key: `aido:v1:notification:unread-count:${mockUserId}:legacy`, ttlMs: 120_000 },
        { key: `aido:v1:notification:unread-count:${mockUserId}`, ttlMs: 120_000 },
      ]);
    });
  });

  describe("알림 읽음 처리 통합 테스트", () => {
    it("단일 알림을 읽음 처리해야 함", async () => {
      // Given
      const [unread] = await seedNotifications([
        createInboxNotificationFixture({ userId: mockUserId, isRead: false, readAt: null }),
      ]);
      if (unread === undefined) {
        throw new Error("notification fixture was not created");
      }

      // When
      const marking = facade.markAsRead(mockUserId, unread.id);

      // Then
      await expect(marking).resolves.toBeUndefined();
      expect(await findNotification(unread.id)).toMatchObject({
        isRead: true,
        readAt: expect.any(Temporal.Instant),
      });
    });

    it("푸시 탭을 멱등 기록하고 읽음 상태로 맞춰야 함", async () => {
      // Given
      const [unread] = await seedNotifications([
        createInboxNotificationFixture({ userId: mockUserId, isRead: false, readAt: null }),
      ]);
      if (unread === undefined) {
        throw new Error("notification fixture was not created");
      }
      await client.insert(pushDispatch).values({
        notificationId: unread.id,
        userId: mockUserId,
        purpose: "TRANSACTIONAL",
        updatedAt: nowInstant(),
      });

      // When
      const first = await facade.markOpened(mockUserId, unread.id);
      const repeated = await facade.markOpened(mockUserId, unread.id);

      // Then
      expect(first).toBe(true);
      expect(repeated).toBe(false);
      expect(await findNotification(unread.id)).toMatchObject({
        isRead: true,
        openedAt: expect.any(Temporal.Instant),
      });
      expect(
        await client.query.pushDispatch.findFirst({ where: { notificationId: unread.id } }),
      ).toMatchObject({ openedAt: expect.any(Temporal.Instant) });
    });

    it("서명 토큰으로 광고성 푸시 동의를 철회해야 함", async () => {
      // Given
      await client.insert(userConsent).values({
        userId: mockUserId,
        marketingPushAgreedAt: Temporal.Instant.from("2026-07-01T00:00:00.000Z"),
      });

      // When
      const result = await facade.optOutMarketingPush(`opt-out:${mockUserId}`);

      // Then
      expect(result).toEqual({ isOptedOut: true, processedAt: expect.any(Date) });
      expect(
        await client.query.userConsent.findFirst({ where: { userId: mockUserId } }),
      ).toMatchObject({ marketingPushAgreedAt: null });
    });

    it("존재하지 않는 알림이면 예외를 발생시켜야 함", async () => {
      // Given
      const missingId = 999;

      // When
      const marking = facade.markAsRead(mockUserId, missingId);

      // Then
      await expect(marking).rejects.toMatchObject({ errorCode: "NOTIFICATION_1004" });
    });

    it("다른 사용자의 알림이면 예외를 발생시켜야 함", async () => {
      // Given
      const [others] = await seedNotifications([
        createInboxNotificationFixture({ userId: "other-user" }),
      ]);
      if (others === undefined) {
        throw new Error("notification fixture was not created");
      }

      // When
      const marking = facade.markAsRead(mockUserId, others.id);

      // Then
      await expect(marking).rejects.toMatchObject({ errorCode: "NOTIFICATION_1005" });
      expect(await findNotification(others.id)).toMatchObject({ isRead: false });
    });

    it("구버전에서 전체 읽음 처리해도 신규 답장·고마움 알림은 읽지 않는다", async () => {
      // Given
      const [, , , , , newer] = await seedNotifications([
        ...Array.from({ length: 5 }, () => createInboxNotificationFixture({ userId: mockUserId })),
        createInboxNotificationFixture({ userId: mockUserId, type: "NUDGE_REPLIED" }),
      ]);
      if (newer === undefined) {
        throw new Error("notification fixture was not created");
      }

      // When
      const result = await facade.markAllAsRead(mockUserId);

      // Then
      expect(result.count).toBe(5);
      expect(await findNotification(newer.id)).toMatchObject({ isRead: false, readAt: null });
      expect(
        await client.$count(
          notification,
          and(eq(notification.userId, mockUserId), eq(notification.isRead, true)),
        ),
      ).toBe(5);
    });

    it("1.13.0은 신규 알림까지 전체 읽음 처리하고 모든 버전 단계의 캐시를 무효화한다", async () => {
      // Given
      await seedNotifications([
        ...Array.from({ length: 5 }, () => createInboxNotificationFixture({ userId: mockUserId })),
        ...Array.from({ length: 2 }, () =>
          createInboxNotificationFixture({ userId: mockUserId, type: "NUDGE_REPLIED" }),
        ),
      ]);
      const cacheStore = module.get(NoCacheStore);
      cacheStore.forgetRecords();

      // When
      const result = await facade.markAllAsRead(mockUserId, "1.13.0");

      // Then
      expect(result.count).toBe(7);
      expect(
        await client.$count(
          notification,
          and(eq(notification.userId, mockUserId), eq(notification.isRead, false)),
        ),
      ).toBe(0);
      expect([...cacheStore.deletedKeys].sort()).toEqual([
        `aido:v1:notification:unread-count:${mockUserId}`,
        `aido:v1:notification:unread-count:${mockUserId}:legacy`,
        `aido:v1:notification:unread-count:${mockUserId}:since-1.11.0`,
      ]);
    });
  });

  describe("알림 생성 및 발송 통합 테스트", () => {
    it("알림과 SINGLE delivery outbox를 같은 흐름에서 준비해야 함", async () => {
      // Given
      await seedPreference(mockUserId, { pushEnabled: true, nightPushEnabled: true });
      await seedPushToken(mockUserId, mockPushToken);
      mockPushProvider.sendBatch.mockResolvedValue({
        successful: [{ token: mockPushToken }],
        failed: [],
      });

      // When
      const result = await facade.publish({
        userId: mockUserId,
        type: "NUDGE_RECEIVED",
        title: "테스트 알림",
        body: "테스트 알림 내용입니다",
      });

      // Then
      expect(result).toMatchObject({
        userId: mockUserId,
        type: "NUDGE_RECEIVED",
        title: "테스트 알림",
        body: "테스트 알림 내용입니다",
      });
      const saved = await client.query.notification.findMany({ where: { userId: mockUserId } });
      expect(saved).toHaveLength(1);
      expect(mockPushDispatchStaging.stage).toHaveBeenCalledWith({
        notificationId: saved[0]?.id,
        userId: mockUserId,
        purpose: "TRANSACTIONAL",
        campaignKey: undefined,
        variantId: undefined,
        deliveryMode: "SINGLE",
        force: false,
      });
      expect(mockAfterCommitPublisher.register).toHaveBeenCalledWith([saved[0]?.id]);
    });

    it("푸시 토큰이 없어도 알림을 생성해야 함", async () => {
      // Given
      const input = {
        userId: mockUserId,
        type: "NUDGE_RECEIVED",
        title: "테스트 알림",
        body: "테스트 알림 내용입니다",
      } as const;

      // When
      const result = await facade.publish(input);

      // Then
      expect(result).toMatchObject(input);
      expect(await client.$count(notification, eq(notification.userId, mockUserId))).toBe(1);
      expect(mockPushProvider.sendBatch).not.toHaveBeenCalled();
    });

    it("MORNING_REMINDER publishBatch 시 title에 {count}가 치환된 값이 저장되어야 함", async () => {
      // Given
      const message = createMorningReminderNotificationMessage({ count: 3 });
      const dataList = [
        {
          userId: mockUserId,
          type: "MORNING_REMINDER" as const,
          title: message.title,
          body: message.body,
        },
      ];
      await seedPreference(mockUserId, { pushEnabled: true, nightPushEnabled: true });
      await seedPushToken(mockUserId, mockPushToken);

      // When
      const result = await facade.publishBatch(dataList);

      // Then
      expect(result.count).toBe(1);
      expect(message.title).toContain("3");
      expect(message.title).not.toContain("{count}");
      const saved = await client.query.notification.findMany({ where: { userId: mockUserId } });
      expect(saved).toHaveLength(1);
      expect(saved[0]?.title).toBe(message.title);
      expect(saved[0]?.title).not.toContain("{count}");
      expect(saved[0]?.type).toBe("MORNING_REMINDER");
    });

    it("할일 없는 사용자에게 MORNING_NO_TODO 메시지로 알림이 정상 생성되어야 함", async () => {
      // Given
      const message = createMorningNoTodoNotificationMessage();
      await seedPreference(mockUserId, { pushEnabled: true, nightPushEnabled: true });
      await seedPushToken(mockUserId, mockPushToken);

      // When
      const result = await facade.publish({
        userId: mockUserId,
        type: "MORNING_REMINDER",
        title: message.title,
        body: message.body,
      });

      // Then
      expect(result).not.toBeNull();
      expect(result?.title).toBe(message.title);
      expect(result?.body).toBe(message.body);
      expect(result?.type).toBe("MORNING_REMINDER");
      expect(
        await client.query.notification.findFirst({ where: { userId: mockUserId } }),
      ).toMatchObject({
        userId: mockUserId,
        type: "MORNING_REMINDER",
        title: message.title,
        body: message.body,
      });
    });

    it("publishBatch에서 할일 있는 사용자와 없는 사용자 알림이 함께 저장되어야 함", async () => {
      // Given
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
      await seedPreference(userWithTodos, { pushEnabled: true, nightPushEnabled: true });
      await seedPreference(userWithoutTodos, { pushEnabled: true, nightPushEnabled: true });
      await seedPushToken(userWithTodos, "token-1");
      await seedPushToken(userWithoutTodos, "token-2");

      // When
      const result = await facade.publishBatch(dataList);

      // Then
      expect(result.count).toBe(2);
      const withTodos = await client.query.notification.findFirst({
        where: { userId: userWithTodos },
      });
      const withoutTodos = await client.query.notification.findFirst({
        where: { userId: userWithoutTodos },
      });
      expect(withTodos?.title).toBe(messageWithTodos.title);
      expect(withTodos?.title).not.toContain("{count}");
      expect(withoutTodos?.title).toBe(messageNoTodos.title);
      expect(withoutTodos?.body).toBe(messageNoTodos.body);
    });

    it("force 항목은 BATCH delivery outbox에 손실 없이 저장되어야 함", async () => {
      // Given
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
      await seedPreference(mockUserId, { pushEnabled: false, nightPushEnabled: false });
      await seedPushToken(mockUserId, mockPushToken);

      // When
      const result = await facade.publishBatch(dataList);

      // Then
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
      // Given
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
      await seedPreference(mockUserId, { pushEnabled: false, nightPushEnabled: false });
      await seedPushToken(mockUserId, mockPushToken);

      // When
      const result = await facade.publishBatch(dataList);

      // Then
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
