import { ErrorCode } from "@aido/api/errors";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";
import { notificationEventJobKey } from "#api/modules/notification/push/infrastructure/jobs/notification-job-keys.constants";
import {
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "#api/modules/notification/push/infrastructure/jobs/notification.queue";
import { ApplicationException } from "#api/shared/application/application.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { RecordingAdminEventNotifier } from "#test/doubles/operations/recording-admin-event-notifier";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";

import type { StoreCustomerConsolePort } from "../../application/ports/store-customer-console.port.js";
import type { StoreSubscriptionEventFailureContext } from "../../application/ports/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../application/read-models/subscription-event-payload.read-model.js";
import { SubscriptionAlerts } from "../../application/subscriptions.alerts.js";
import { SubscriptionEventNotifierAdapter } from "./subscription-event-notifier.adapter.js";

function createAdapter(options: { customerConsoleUrl?: string } = {}) {
  const adminEventNotifier = new RecordingAdminEventNotifier();
  const alerts = new RecordingOperationalAlert();
  const jobQueue = new InMemoryJobQueue();
  const customerConsole: StoreCustomerConsolePort = {
    customerUrlOf: (appUserId) =>
      options.customerConsoleUrl == null ? null : `${options.customerConsoleUrl}/${appUserId}`,
  };
  const adapter = new SubscriptionEventNotifierAdapter(
    adminEventNotifier,
    new NotificationQueueAdapter(
      jobQueue,
      new FixedClock(Temporal.Instant.from("2028-02-26T12:00:00Z")),
    ),
    alerts,
    customerConsole,
  );
  return { adapter, alerts, forwarded: adminEventNotifier.subscriptionEvents, jobQueue };
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
        ...SubscriptionAlerts.WEBHOOK_PROCESSING_FAILED,
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

  it("공급자 고객 화면 주소가 있으면 앱 사용자 ID로 만든 주소를 붙여 넘긴다", () => {
    // Given
    const { adapter, forwarded } = createAdapter({ customerConsoleUrl: "https://console.test" });

    // When
    adapter.notifySubscriptionEvent(event);

    // Then
    expect(forwarded[0]?.providerCustomerUrl).toBe("https://console.test/app user/1");
  });

  it("공급자 고객 화면 주소가 없으면 주소 없이 넘기고 앱 사용자 ID는 싣지 않는다", () => {
    // Given
    const { adapter, forwarded } = createAdapter();

    // When
    adapter.notifySubscriptionEvent(event);

    // Then
    expect(forwarded).toEqual([
      {
        userId: "user-1",
        email: "user@example.com",
        kind: "STARTED",
        productId: "premium_monthly",
        store: "APP_STORE",
      },
    ]);
    expect(forwarded[0]).not.toHaveProperty("appUserId");
    expect(forwarded[0]?.providerCustomerUrl).toBeUndefined();
  });
});

describe("SubscriptionEventNotifierAdapter — 결제 문제 푸시 기록", () => {
  beforeEach(suppressLogger);

  it("발생 시각을 같은 시각의 Date로 바꿔 결제 문제 알림 작업을 등록한다", async () => {
    // Given
    const { adapter, jobQueue } = createAdapter();
    const at = Temporal.Instant.from("2028-02-26T12:00:00.000Z");
    const job = { name: NotificationJobName.BILLING_ISSUE, data: { userId: "user-1" } } as const;

    // When
    await adapter.recordBillingIssue(UserId.reconstitute("user-1"), at);

    // Then
    const queued = jobQueue.jobsIn(NOTIFICATION_QUEUE);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload).toEqual(job);
    expect(queued[0]?.options.idempotencyKey).toBe(
      notificationEventJobKey(job, new Date("2028-02-26T12:00:00.000Z")),
    );
  });
});
