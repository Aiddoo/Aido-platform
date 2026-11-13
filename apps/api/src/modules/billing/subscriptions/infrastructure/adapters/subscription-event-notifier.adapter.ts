import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";
import {
  AdminEventNotifierPort,
  type SubscriptionNoticeInput,
} from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { StoreCustomerConsolePort } from "../../application/ports/store-customer-console.port.js";
import {
  type StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../../application/ports/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../application/read-models/subscription-event-payload.read-model.js";
import { SubscriptionAlerts } from "../../application/subscriptions.alerts.js";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림은 커밋 뒤 admin-notification 큐로 기다리지 않고 넘긴다. 결제 문제 푸시는 활성 UoW 안에서
 * notification 큐에 기록해 처리 원장과 함께 커밋한다. 웹훅 처리 실패는 운영 경보로 올린다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter extends SubscriptionEventNotifierPort {
  readonly #adminEventNotifier: AdminEventNotifierPort;
  readonly #notificationQueueService: NotificationQueueAdapter;
  readonly #alert: OperationalAlertPort;
  readonly #customerConsole: StoreCustomerConsolePort;

  constructor(
    adminEventNotifier: AdminEventNotifierPort,
    notificationQueueService: NotificationQueueAdapter,
    alert: OperationalAlertPort,
    customerConsole: StoreCustomerConsolePort,
  ) {
    super();
    this.#adminEventNotifier = adminEventNotifier;
    this.#notificationQueueService = notificationQueueService;
    this.#alert = alert;
    this.#customerConsole = customerConsole;
  }

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    this.#adminEventNotifier.notifySubscriptionEvent(
      toSubscriptionNoticeInput(payload, this.#providerCustomerUrl(payload.appUserId)),
    );
  }

  recordBillingIssue(userId: UserId, at: Temporal.Instant): Promise<void> {
    return this.#notificationQueueService.enqueueBillingIssue({ userId: userId.value }, at);
  }

  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void {
    this.#alert.raise({
      ...SubscriptionAlerts.WEBHOOK_PROCESSING_FAILED,
      // Sentry 이벤트의 environment는 배포 환경(APP_ENV)이라 스토어 결제 환경은 다른 이름으로 싣는다
      tags: {
        eventKind: context.kind,
        store: context.store ?? "unknown",
        storeEnvironment: context.environment ?? "unknown",
      },
      details: {
        eventId: context.providerEventId ?? null,
        productId: context.productId ?? null,
        errorType: toErrorType(error),
        errorCode: error instanceof ErrorCodedException ? error.errorCode : null,
      },
      cause: error,
    });
  }

  #providerCustomerUrl(appUserId: string | undefined): string | undefined {
    if (appUserId == null) {
      return undefined;
    }
    return this.#customerConsole.customerUrlOf(appUserId) ?? undefined;
  }
}

// operations가 소유한 입력 모양으로 한 필드씩 옮긴다. 앱 사용자 ID 같은 billing 내부 값은 넘기지 않는다
function toSubscriptionNoticeInput(
  payload: SubscriptionEventPayload,
  providerCustomerUrl: string | undefined,
) {
  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    kind: payload.kind,
    isOneTime: payload.isOneTime,
    productId: payload.productId,
    planType: payload.planType,
    store: payload.store,
    environment: payload.environment,
    storeSubscriptionId: payload.storeSubscriptionId,
    purchasedAt: payload.purchasedAt,
    expiresAt: payload.expiresAt,
    gracePeriodEndsAt: payload.gracePeriodEndsAt,
    endReason: payload.endReason,
    priceUsd: payload.priceUsd,
    priceInPurchasedCurrency: payload.priceInPurchasedCurrency,
    purchasedCurrency: payload.purchasedCurrency,
    newProductId: payload.newProductId,
    newPlanType: payload.newPlanType,
    transfer: payload.transfer,
    providerCustomerUrl,
    eventId: payload.eventId,
    countryCode: payload.countryCode,
    periodKind: payload.periodKind,
    appVersion: payload.appVersion,
    deviceModel: payload.deviceModel,
    lifecycle: payload.lifecycle,
    isFirstPurchase: payload.isFirstPurchase,
    premium: payload.premium,
  } satisfies SubscriptionNoticeInput;
}
