import {
  TimezoneReminderEnqueuerPort,
  TimezoneReminderQueueService,
} from "#api/modules/notification/notification-reminders-jobs.public";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "#test/e2e/helpers/index";

// identity가 옛 클래스 이름으로 주입받아도 리마인더 포트와 같은 인스턴스를 받아야 한다
describe("리마인더 옛 토큰·이름 호환 (E2E 앱 조립)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    ["TimezoneReminderQueueService", TimezoneReminderQueueService, TimezoneReminderEnqueuerPort],
  ] as const)("%s는 새 포트와 같은 인스턴스다", (_name, legacyToken, portClass) => {
    // Given
    const options = { strict: false } as const;

    // When
    const legacy: unknown = ctx.app.get(legacyToken, options);
    const current: unknown = ctx.app.get(portClass, options);

    // Then
    expect(current).toBeDefined();
    expect(legacy).toBe(current);
  });
});
