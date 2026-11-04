import { Inject, Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { AdminEventNotifier } from "#api/modules/operations/operations-notifications.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { SENTRY_DOMAIN, SENTRY_EXTRA, SENTRY_TAG } from "#api/platform/observability/sentry-keys";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { maskUserId } from "#api/shared/domain/utils/mask.util";

import { BillingAlertKey } from "../../../application/observability/subscriptions/billing-alerts.js";
import type {
  SubscriptionEventNotifierPort,
  WebhookFailureContext,
} from "../../../application/ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../../application/types/subscriptions/subscription-event.payload.js";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림은 admin-notification 큐로, 결제 이슈 푸시는 notification 큐로
 * fire-and-forget 위임한다. 트랜잭션 커밋 후 use-case가 호출한다.
 * 웹훅 처리 실패는 Sentry 예외와 운영 경보로 보고한다 — 벤더 SDK는 infrastructure에 격리한다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter implements SubscriptionEventNotifierPort {
  constructor(
    private readonly adminEventNotifier: AdminEventNotifier,
    private readonly notificationQueueService: NotificationQueueService,
    @Inject(OPERATIONAL_ALERT) private readonly alert: OperationalAlertPort,
    private readonly config: TypedConfigService,
  ) {}

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    const projectId = this.config.revenuecat.projectId;
    this.adminEventNotifier.notifySubscriptionEvent(
      projectId == null || payload.appUserId == null
        ? payload
        : {
            ...payload,
            revenueCatCustomerUrl: `https://app.revenuecat.com/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(payload.appUserId)}`,
          },
    );
  }

  notifyBillingIssue(userId: string): void {
    this.notificationQueueService.enqueueBillingIssue({ userId });
  }

  reportWebhookFailure(error: unknown, context: WebhookFailureContext): void {
    Sentry.withScope((scope) => {
      scope.setTag(SENTRY_TAG.DOMAIN, SENTRY_DOMAIN.PAYMENT);
      scope.setTag(SENTRY_TAG.WEBHOOK_EVENT_TYPE, context.eventType);
      scope.setTag(SENTRY_TAG.WEBHOOK_STORE, context.store ?? "unknown");
      if (context.appUserId != null) {
        scope.setExtra(SENTRY_EXTRA.WEBHOOK_APP_USER_ID, maskUserId(context.appUserId));
      }
      if (context.productId != null) {
        scope.setExtra(SENTRY_EXTRA.WEBHOOK_PRODUCT_ID, context.productId);
      }
      scope.setExtra(SENTRY_EXTRA.WEBHOOK_EVENT_ID, context.eventId);
      Sentry.captureException(error);
    });

    this.alert.raise({
      key: BillingAlertKey.WEBHOOK_PROCESSING_FAILED,
      severity: "error",
      message: "RevenueCat 웹훅 처리에 실패했습니다",
      tags: { eventType: context.eventType, store: context.store ?? "unknown" },
      details: { eventId: context.eventId ?? null, productId: context.productId ?? null },
    });
  }
}
