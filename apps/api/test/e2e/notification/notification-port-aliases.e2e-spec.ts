import { DeleteActorNotificationsUseCase } from "#api/modules/notification/inbox/application/use-cases/delete-actor-notifications.use-case";
import {
  NotificationQueueAdapter,
  NotificationQueueService,
} from "#api/modules/notification/notification-delivery-jobs.public";
import {
  NotificationAccountCleanup,
  NotificationDeliveryModule,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";
import { NotificationQueueAdapter as NotificationQueueAdapterClass } from "#api/modules/notification/push/infrastructure/jobs/notification-queue.adapter";
import { NotificationPushModule } from "#api/modules/notification/push/notification-push.module";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "#test/e2e/helpers/index";

// 다른 Context가 옛 클래스 이름으로 주입받아도 새 UseCase·어댑터와 같은 인스턴스를 받아야 한다
describe("알림 옛 토큰·이름 호환 (E2E 앱 조립)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
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
