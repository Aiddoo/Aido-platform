import { Inject, Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import {
  AdminEventNotifier,
  type AdminNotifier,
  PAYMENT_NOTIFIER,
} from "#api/modules/operations/operations-notifications.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { SENTRY_DOMAIN, SENTRY_EXTRA, SENTRY_TAG } from "#api/platform/observability/sentry-keys";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { maskUserId } from "#api/shared/domain/utils/mask.util";

import { BillingLogEvent } from "../../../application/observability/subscriptions/billing-log.events.js";
import type {
  SubscriptionEventNotifierPort,
  WebhookFailureContext,
} from "../../../application/ports/subscriptions/subscription-event-notifier.port.js";
import type { SubscriptionEventPayload } from "../../../application/types/subscriptions/subscription-event.payload.js";

/**
 * 구독 이벤트 알림 어댑터.
 *
 * 관리자 알림(Discord)은 admin-notification 큐로, 결제 이슈 푸시는 notification 큐로
 * fire-and-forget 위임한다. 트랜잭션 커밋 후 use-case가 호출한다.
 * 웹훅 처리 실패는 Sentry(에러 관측)·Discord(관리자 알림)로 보고한다 — 벤더 SDK는
 * infrastructure에 격리한다.
 */
@Injectable()
export class SubscriptionEventNotifierAdapter implements SubscriptionEventNotifierPort {
  readonly #logger = new Logger(SubscriptionEventNotifierAdapter.name);

  constructor(
    private readonly adminEventNotifier: AdminEventNotifier,
    private readonly notificationQueueService: NotificationQueueService,
    @Inject(PAYMENT_NOTIFIER)
    private readonly paymentNotifier: AdminNotifier,
    private readonly config: TypedConfigService,
  ) {}

  notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
    const projectId = this.config.get("REVENUECAT_PROJECT_ID");
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

    // 2. Discord 관리자 알림 (fire-and-forget)
    this.#notifyWebhookError(error, context).catch((alertError: unknown) =>
      this.#logger.warn({
        event: BillingLogEvent.WEBHOOK_ALERT_FAILED,
        eventId: context.eventId,
        errorType: toErrorType(alertError),
      }),
    );
  }

  async #notifyWebhookError(error: unknown, context: WebhookFailureContext): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.paymentNotifier.send({
      title: "Webhook 처리 에러",
      body: "RevenueCat 웹훅 처리 중 에러가 발생했습니다.",
      color: 0xff0000,
      fields: [
        {
          name: "에러",
          value: errorMessage.slice(0, 1024),
          inline: false,
        },
        {
          name: "이벤트 타입",
          value: context.eventType,
          inline: true,
        },
        {
          name: "사용자 ID",
          value: context.appUserId ?? "-",
          inline: true,
        },
        {
          name: "상품",
          value: context.productId ?? "-",
          inline: true,
        },
      ],
    });
  }
}
