import { ErrorCode } from "@aido/api/errors";
import { ConfigService } from "@nestjs/config";

import { NotificationJobName } from "#api/modules/notification/infrastructure/jobs/delivery/notification-queue.constants";
import { notificationEventJobKey } from "#api/modules/notification/infrastructure/jobs/notification-job-keys";
import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import type { EnvConfig } from "#api/platform/config/schemas/index";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { ApplicationException } from "#api/shared/application/application.exception";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { StoreSubscriptionEventFailureContext } from "../../application/ports/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../application/read-models/subscription-event-payload.read-model.js";
import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

function createAdapter(options: { projectId?: string } = {}) {
  const forwarded: SubscriptionEventPayload[] = [];
  const alerts = new RecordingOperationalAlert();
  const jobRuntime = new FakeJobRuntime();
  const adminEventNotifier = new AdminEventNotifier({
    enqueueUserRegistered: { execute: async () => undefined },
    enqueueSubscriptionEvent: {
      execute: async (payload) => {
        forwarded.push(payload);
      },
    },
    logger: new SilentLogger(),
  });
  const config = new TypedConfigService(
    new ConfigService<EnvConfig, true>({ REVENUECAT_PROJECT_ID: options.projectId }),
  );
  const adapter = new SubscriptionEventNotifierAdapter(
    adminEventNotifier,
    new NotificationQueueService(jobRuntime),
    alerts,
    config,
  );
  return { adapter, alerts, forwarded, jobRuntime };
}

describe("SubscriptionEventNotifierAdapter — 웹훅 실패 보고", () => {
  const context: StoreSubscriptionEventFailureContext = {
    kind: "STARTED",
    providerEventId: "evt-1",
    store: "APP_STORE",
    environment: "SANDBOX",
    productId: "premium_monthly",
  };

  it("경보 태그와 세부 값에는 이벤트 식별자와 오류 종류만 싣고 스택은 원인 예외로 넘긴다", () => {
    // Given
    const { adapter, alerts } = createAdapter();
    const error = new TypeError("private-provider-message user-123");

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(alerts.alerts).toEqual([
      {
        key: "billing.subscription.webhook.processing-failed",
        severity: "error",
        message: "RevenueCat 웹훅 처리에 실패했습니다",
        tags: { eventKind: "STARTED", store: "APP_STORE", storeEnvironment: "SANDBOX" },
        details: {
          eventId: "evt-1",
          productId: "premium_monthly",
          errorType: "TypeError",
          errorCode: null,
        },
        cause: error,
      },
    ]);
    expect(JSON.stringify(alerts.alerts)).not.toContain("private-provider-message");
    expect(JSON.stringify(alerts.alerts)).not.toContain("user-123");
  });

  it("오류 코드가 있는 실패는 코드도 경보에 싣는다", () => {
    // Given
    const { adapter, alerts } = createAdapter();
    const error = new ApplicationException(ErrorCode.SUBSCRIPTION_1602);

    // When
    adapter.reportWebhookFailure(error, context);

    // Then
    expect(alerts.alerts[0]?.details).toMatchObject({ errorCode: ErrorCode.SUBSCRIPTION_1602 });
  });

  it("스토어·환경·이벤트 id가 없는 웹훅도 경보를 올린다", () => {
    // Given
    const { adapter, alerts } = createAdapter();
    const transfer: StoreSubscriptionEventFailureContext = { kind: "TRANSFERRED" };

    // When
    adapter.reportWebhookFailure(new Error("x"), transfer);

    // Then
    expect(alerts.alerts[0]).toMatchObject({
      tags: { eventKind: "TRANSFERRED", store: "unknown", storeEnvironment: "unknown" },
      details: { eventId: null, productId: null },
    });
  });
});

describe("SubscriptionEventNotifierAdapter — 구독 이벤트 운영 알림", () => {
  const event: SubscriptionEventPayload = {
    userId: "user-1",
    email: "user@example.com",
    kind: "STARTED",
    productId: "premium_monthly",
    store: "APP_STORE",
    appUserId: "app user/1",
  };

  it("프로젝트 ID가 있으면 RevenueCat 고객 화면 주소를 붙여 넘긴다", () => {
    // Given
    const { adapter, forwarded } = createAdapter({ projectId: "6a6ea506" });

    // When
    adapter.notifySubscriptionEvent(event);

    // Then
    expect(forwarded[0]?.providerCustomerUrl).toBe(
      "https://app.revenuecat.com/projects/6a6ea506/customers/app%20user%2F1",
    );
  });

  it("프로젝트 ID가 없으면 받은 그대로 넘긴다", () => {
    // Given
    const { adapter, forwarded } = createAdapter();

    // When
    adapter.notifySubscriptionEvent(event);

    // Then
    expect(forwarded).toEqual([event]);
  });
});

describe("SubscriptionEventNotifierAdapter — 결제 문제 푸시 기록", () => {
  beforeEach(suppressLogger);

  it("발생 시각을 같은 시각의 Date로 바꿔 결제 문제 알림 작업을 등록한다", async () => {
    // Given
    const { adapter, jobRuntime } = createAdapter();
    const at = Temporal.Instant.from("2028-02-26T12:00:00.000Z");
    const job = { name: NotificationJobName.BILLING_ISSUE, data: { userId: "user-1" } } as const;

    // When
    await adapter.recordBillingIssue("user-1", at);

    // Then
    expect(jobRuntime.enqueueCalls).toHaveLength(1);
    expect(jobRuntime.enqueueCalls[0]?.data).toEqual(job);
    expect(jobRuntime.enqueueCalls[0]?.options.idempotencyKey).toBe(
      notificationEventJobKey(job, new Date("2028-02-26T12:00:00.000Z")),
    );
  });
});
