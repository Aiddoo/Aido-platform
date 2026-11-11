import {
  type RevenueCatWebhookPayload,
  revenueCatTransferWebhookPayloadSchema,
  revenueCatWebhookPayloadSchema,
} from "@aido/api/contracts/subscription";
import { match } from "ts-pattern";

import type {
  StoreSubscriptionEvent,
  StoreSubscriptionEventDetails,
} from "../../../domain/store-subscription.event.js";
import { toStorePeriodType } from "../../../domain/subscription-lifecycle.domain-service.js";
import {
  SUBSCRIPTION_END_REASONS,
  type SubscriptionEndReason,
  type SubscriptionStore,
} from "../../../domain/subscriptions.constants.js";
import {
  revenueCatEventDetailsSchema,
  revenueCatEventTypeSchema,
  revenueCatTestStoreEventSchema,
} from "./revenuecat-event.wire.js";

type RevenueCatEvent = RevenueCatWebhookPayload["event"];

export type RevenueCatTranslation =
  | { readonly status: "translated"; readonly event: StoreSubscriptionEvent }
  | {
      readonly status: "skipped";
      readonly reason: "TEST_STORE";
      readonly eventType?: string;
      readonly eventId?: string;
    }
  | { readonly status: "invalid"; readonly eventType?: string; readonly issueCount: number };

export interface RevenueCatTranslationOptions {
  /** RevenueCat Test Store 구매(실제 결제 없음)를 구독 이벤트로 받을지. 받지 않으면 skipped다. */
  readonly acceptsTestStore: boolean;
}

const PROVIDER = "REVENUECAT";

/** RevenueCat은 환불을 별도 이벤트가 아니라 CANCELLATION + cancel_reason=CUSTOMER_SUPPORT로 보낸다 */
const REFUND_CANCEL_REASON = "CUSTOMER_SUPPORT";

const STORES: Readonly<Record<string, SubscriptionStore>> = {
  APP_STORE: "APP_STORE",
  MAC_APP_STORE: "MAC_APP_STORE",
  PLAY_STORE: "PLAY_STORE",
  STRIPE: "STRIPE",
  RC_BILLING: "WEB_BILLING",
  AMAZON: "AMAZON",
  PROMOTIONAL: "PROMOTIONAL",
};

function storeOf(store: string | undefined): SubscriptionStore | null {
  return store == null ? null : (STORES[store] ?? null);
}

// 웹훅 계약에서 0은 빠진 시각이다
function instantOf(ms: number | null | undefined): Temporal.Instant | undefined {
  return ms == null || ms === 0 ? undefined : Temporal.Instant.fromEpochMilliseconds(ms);
}

function eventIdOf(id: string | undefined): string | undefined {
  return id == null || id === "" ? undefined : id;
}

function endReasonOf(reason: string | undefined): SubscriptionEndReason | null {
  if (reason == null) {
    return null;
  }
  return SUBSCRIPTION_END_REASONS.find((known) => known === reason) ?? "UNKNOWN";
}

// 이전 이벤트도 같은 부가 정보를 읽으므로 원문 이벤트를 넓게 받는다
function detailsOf(event: unknown): StoreSubscriptionEventDetails {
  const parsed = revenueCatEventDetailsSchema.safeParse(event);
  if (!parsed.success) {
    return {};
  }
  const attributes = parsed.data.subscriber_attributes;
  return {
    ...(parsed.data.country_code != null && { countryCode: parsed.data.country_code }),
    ...(attributes?.appVersion != null && { appVersion: attributes.appVersion }),
    ...(attributes?.deviceModel != null && { deviceModel: attributes.deviceModel }),
  };
}

function chainEventOf(event: RevenueCatEvent): StoreSubscriptionEvent {
  const common = {
    provider: PROVIDER,
    providerEventId: eventIdOf(event.id),
    providerEventType: event.type,
    environment: event.environment ?? null,
    store: storeOf(event.store),
    details: detailsOf(event),
    appUserId: event.app_user_id,
    storeSubscriptionId: event.original_transaction_id ?? event.transaction_id,
    productId: event.product_id,
    periodEndsAt: instantOf(event.expiration_at_ms),
    periodKind: toStorePeriodType(event.period_type),
    price: {
      usd: event.price,
      amountInPurchasedCurrency: event.price_in_purchased_currency,
      purchasedCurrency: event.currency,
    },
  } as const;
  return (
    match(event.type)
      .returnType<StoreSubscriptionEvent>()
      .with("INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", (type) => ({
        ...common,
        kind: "STARTED",
        isOneTime: type === "NON_RENEWING_PURCHASE",
        startedAt: instantOf(event.purchased_at_ms),
      }))
      .with("RENEWAL", () => ({
        ...common,
        kind: "RENEWED",
        startedAt: instantOf(event.purchased_at_ms),
        isTrialConversion: event.is_trial_conversion === true,
      }))
      .with("CANCELLATION", () => ({
        ...common,
        kind: event.cancel_reason === REFUND_CANCEL_REASON ? "REFUNDED" : "CANCELLED",
        reason: endReasonOf(event.cancel_reason),
      }))
      .with("EXPIRATION", () => ({
        ...common,
        kind: "EXPIRED",
        reason: endReasonOf(event.expiration_reason),
      }))
      .with("BILLING_ISSUE", () => ({
        ...common,
        kind: "BILLING_ISSUE",
        gracePeriodEndsAt: instantOf(event.grace_period_expiration_at_ms) ?? null,
      }))
      // RevenueCat 문서상 PRODUCT_CHANGE는 정보성이고 적용은 이후 RENEWAL(Apple)·INITIAL_PURCHASE(Play)다
      .with("PRODUCT_CHANGE", () => ({
        ...common,
        kind: "PRODUCT_CHANGE_SCHEDULED",
        newProductId: event.new_product_id,
      }))
      .with("UNCANCELLATION", () => ({ ...common, kind: "UNCANCELLED" }))
      .with("SUBSCRIPTION_EXTENDED", () => ({ ...common, kind: "EXTENDED" }))
      .with("TRANSFER", () => ({
        provider: PROVIDER,
        providerEventId: common.providerEventId,
        providerEventType: event.type,
        environment: common.environment,
        store: common.store,
        details: common.details,
        kind: "TRANSFERRED",
        receivers: [event.app_user_id, ...(event.transferred_to ?? [])],
        transferredFrom: event.transferred_from ?? [],
      }))
      .otherwise(() => ({ ...common, kind: "IGNORED" }))
  );
}

/**
 * RevenueCat 웹훅 원문을 공급자를 모르는 스토어 구독 이벤트로 바꾼다.
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export function translateRevenueCatWebhook(
  body: unknown,
  { acceptsTestStore }: RevenueCatTranslationOptions,
): RevenueCatTranslation {
  if (!acceptsTestStore) {
    const testStore = revenueCatTestStoreEventSchema.safeParse(body);
    if (testStore.success) {
      const { type, id } = testStore.data.event;
      return {
        status: "skipped",
        reason: "TEST_STORE",
        ...(type != null && { eventType: type }),
        ...(id != null && { eventId: id }),
      };
    }
  }
  // TRANSFER에는 app_user_id·product_id가 없어 전용 스키마로 먼저 받는다
  const transfer = revenueCatTransferWebhookPayloadSchema.safeParse(body);
  if (transfer.success) {
    const event = transfer.data.event;
    return {
      status: "translated",
      event: {
        provider: PROVIDER,
        providerEventId: eventIdOf(event.id),
        providerEventType: event.type,
        environment: event.environment ?? null,
        store: storeOf(event.store),
        details: detailsOf(event),
        kind: "TRANSFERRED",
        receivers: event.transferred_to,
        transferredFrom: event.transferred_from,
      },
    };
  }
  const parsed = revenueCatWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const typed = revenueCatEventTypeSchema.safeParse(body);
    return {
      status: "invalid",
      ...(typed.success && { eventType: typed.data.event.type }),
      issueCount: parsed.error.issues.length,
    };
  }
  return { status: "translated", event: chainEventOf(parsed.data.event) };
}
