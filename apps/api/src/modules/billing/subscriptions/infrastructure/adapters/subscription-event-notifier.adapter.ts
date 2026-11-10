import { Inject, Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { AdminEventNotifierPort } from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { instantToDate } from "#api/shared/domain/time/instant";

import {
  type StoreSubscriptionEventFailureContext,
  SubscriptionEventNotifierPort,
} from "../../application/ports/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../application/read-models/subscription-event-payload.read-model.js";
import { SubscriptionAlertKey } from "../../application/subscriptions.alerts.js";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림은 커밋 뒤 admin-notification 큐로 기다리지 않고 넘긴다. 결제 문제 푸시는 활성 UoW 안에서
 * notification 큐에 기록해 처리 원장과 함께 커밋한다. 웹훅 처리 실패는 운영 경보로 올린다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter extends SubscriptionEventNotifierPort {
  readonly #adminEventNotifier: AdminEventNotifierPort;
  readonly #notificationQueueService: NotificationQueueService;
  readonly #alert: OperationalAlertPort;
  readonly #config: TypedConfigService;

  constructor(
    adminEventNotifier: AdminEventNotifierPort,
    notificationQueueService: NotificationQueueService,
    alert: OperationalAlertPort,
    @Inject(TypedConfigService) config: TypedConfigService,
  ) {
    super();
    this.#adminEventNotifier = adminEventNotifier;
    this.#notificationQueueService = notificationQueueService;
    this.#alert = alert;
    this.#config = config;
  }

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    const projectId = this.#config.revenuecat.projectId;
    this.#adminEventNotifier.notifySubscriptionEvent(
      projectId == null || payload.appUserId == null
        ? payload
        : {
            ...payload,
            providerCustomerUrl: `https://app.revenuecat.com/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(payload.appUserId)}`,
          },
    );
  }

  recordBillingIssue(userId: string, at: Temporal.Instant): Promise<void> {
    return this.#notificationQueueService.enqueueBillingIssue({ userId }, instantToDate(at));
  }

  reportWebhookFailure(error: unknown, context: StoreSubscriptionEventFailureContext): void {
    this.#alert.raise({
      key: SubscriptionAlertKey.WEBHOOK_PROCESSING_FAILED,
      severity: "error",
      message: "RevenueCat 웹훅 처리에 실패했습니다",
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
}
