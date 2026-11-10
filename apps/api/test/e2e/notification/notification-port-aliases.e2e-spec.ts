import {
  NOTIFICATION_CACHE,
  NotificationCachePort,
} from "#api/modules/notification/inbox/application/ports/notification-cache.port";
import {
  NOTIFICATION_HISTORY_READER,
  NotificationHistoryReaderPort,
} from "#api/modules/notification/inbox/application/ports/notification-history.reader.port";
import {
  NOTIFICATION_INBOX_READER,
  NotificationInboxReaderPort,
} from "#api/modules/notification/inbox/application/ports/notification-inbox.reader.port";
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepositoryPort,
} from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import { DeleteActorNotificationsUseCase } from "#api/modules/notification/inbox/application/use-cases/delete-actor-notifications.use-case";
import {
  NotificationQueueAdapter,
  NotificationQueueService,
} from "#api/modules/notification/notification-delivery-jobs.public";
import {
  CLIENT_APP_VERSION_READER,
  ClientAppVersionReaderPort,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  NOTIFICATION_RECIPIENT_TIMEZONE_READER,
  NotificationAccountCleanup,
  NotificationDeliveryModule,
  NotificationPublisher,
  NotificationRecipientLocaleReaderPort,
  NotificationRecipientTimezoneReaderPort,
  PUSH_CAMPAIGN_OUTCOME_READER,
  PUSH_QUIET_HOURS_READER,
  PushCampaignOutcomeReaderPort,
  PushQuietHoursReaderPort,
  SESSION_PUSH_DEVICE_RELEASE,
  SessionPushDeviceReleasePort,
} from "#api/modules/notification/notification-delivery.public";
import { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";
import { NotificationQueueAdapter as NotificationQueueAdapterClass } from "#api/modules/notification/push/infrastructure/jobs/notification-queue.adapter";
import { NotificationPushModule } from "#api/modules/notification/push/notification-push.module";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "#test/e2e/helpers/index";

// 다른 Context가 옛 Symbol·클래스 이름으로 주입받아도 새 포트와 같은 인스턴스를 받아야 한다
describe("알림 옛 토큰·이름 호환 (E2E 앱 조립)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    [
      "NOTIFICATION_RECIPIENT_LOCALE_READER",
      NOTIFICATION_RECIPIENT_LOCALE_READER,
      NotificationRecipientLocaleReaderPort,
    ],
    [
      "NOTIFICATION_RECIPIENT_TIMEZONE_READER",
      NOTIFICATION_RECIPIENT_TIMEZONE_READER,
      NotificationRecipientTimezoneReaderPort,
    ],
    ["PUSH_QUIET_HOURS_READER", PUSH_QUIET_HOURS_READER, PushQuietHoursReaderPort],
    ["PUSH_CAMPAIGN_OUTCOME_READER", PUSH_CAMPAIGN_OUTCOME_READER, PushCampaignOutcomeReaderPort],
    ["CLIENT_APP_VERSION_READER", CLIENT_APP_VERSION_READER, ClientAppVersionReaderPort],
    ["SESSION_PUSH_DEVICE_RELEASE", SESSION_PUSH_DEVICE_RELEASE, SessionPushDeviceReleasePort],
    ["NOTIFICATION_REPOSITORY", NOTIFICATION_REPOSITORY, NotificationRepositoryPort],
    ["NOTIFICATION_INBOX_READER", NOTIFICATION_INBOX_READER, NotificationInboxReaderPort],
    ["NOTIFICATION_HISTORY_READER", NOTIFICATION_HISTORY_READER, NotificationHistoryReaderPort],
    ["NOTIFICATION_CACHE", NOTIFICATION_CACHE, NotificationCachePort],
  ] as const)("%s는 새 포트와 같은 인스턴스다", (_name, symbol, portClass) => {
    // Given
    const options = { strict: false } as const;

    // When
    const legacy: unknown = ctx.app.get(symbol, options);
    const current: unknown = ctx.app.get(portClass, options);

    // Then
    expect(current).toBeDefined();
    expect(legacy).toBe(current);
  });

  it("shim의 옛 클래스 이름은 새 클래스와 같은 클래스 객체다", () => {
    // Given
    const pairs = [
      [NotificationPublisher, PublishNotificationUseCase],
      [NotificationQueueService, NotificationQueueAdapterClass],
      [NotificationQueueAdapter, NotificationQueueAdapterClass],
      [NotificationAccountCleanup, DeleteActorNotificationsUseCase],
      [NotificationDeliveryModule, NotificationPushModule],
    ] as const;

    // When
    const sameClasses = pairs.map(([legacy, current]) => legacy === current);

    // Then
    expect(sameClasses).toEqual([true, true, true, true, true]);
  });

  it("옛 클래스 이름으로 꺼낸 UseCase·어댑터도 앱이 가진 그 인스턴스다", () => {
    // Given
    const options = { strict: false } as const;

    // When
    const instances = [
      [
        ctx.app.get(NotificationPublisher, options),
        ctx.app.get(PublishNotificationUseCase, options),
      ],
      [
        ctx.app.get(NotificationQueueService, options),
        ctx.app.get(NotificationQueueAdapterClass, options),
      ],
      [
        ctx.app.get(NotificationAccountCleanup, options),
        ctx.app.get(DeleteActorNotificationsUseCase, options),
      ],
    ] as const;

    // Then
    for (const [legacy, current] of instances) {
      expect(legacy).toBeDefined();
      expect(legacy).toBe(current);
    }
  });
});
