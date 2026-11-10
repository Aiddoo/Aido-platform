import { Inject, Injectable, Logger } from "@nestjs/common";
import { HttpClient, InjectHttpClient } from "@nestjs/http-client";
import { sortBy } from "es-toolkit";
import type { z } from "zod";

import { requestVendorJson } from "#api/platform/http/request-vendor-json";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { StoreSubscriptionStatusReaderPort } from "../../../application/ports/store-subscription-status.reader.port.js";
import {
  type BillingSubscriptionsConfig,
  billingSubscriptionsConfig,
} from "../../../billing-subscriptions.config.js";
import type { StoreSubscriptionState } from "../../../domain/subscription.aggregate.js";
import { REVENUECAT_API_POLICY } from "./revenuecat-outbound.policy.js";
import {
  type RevenueCatSubscription,
  revenueCatProductSchema,
  revenueCatSubscriptionListSchema,
} from "./revenuecat-subscription.wire.js";
import { RevenueCatLogEvent } from "./revenuecat.log-events.js";

export const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com/v2";
export const REVENUECAT_HTTP_CLIENT = "revenuecat";
export const REVENUECAT_TIMEOUT_MS = 10_000;

/** 다음 결제가 예정된 자동 갱신 상태. will_not_renew·will_pause는 결제가 이어지지 않는다. */
const RENEWING_STATUSES: ReadonlySet<string> = new Set([
  "will_renew",
  "will_change_product",
  "requires_price_increase_consent",
  "has_already_renewed",
]);

const REVENUECAT_REQUEST_ERROR_REASONS = ["http", "invalid_response"] as const;

type RevenueCatRequestErrorReason = (typeof REVENUECAT_REQUEST_ERROR_REASONS)[number];

/** RevenueCat이 실패로 응답했다. 응답 본문은 담지 않는다. */
export class RevenueCatRequestError extends Error {
  readonly reason: RevenueCatRequestErrorReason;
  readonly statusCode: number | null;

  constructor(reason: RevenueCatRequestErrorReason, statusCode: number | null) {
    super(`RevenueCat request failed: ${reason}`);
    this.name = "RevenueCatRequestError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

/**
 * RevenueCat REST v2로 체인 상태를 읽는다. 우리 체인 키(원 거래 ID)로 찾는 검색은 App Store의 어떤 거래 ID나
 * Play의 어떤 주문 ID도 받으므로 행과 1:1로 맞는다.
 *
 * @see https://www.revenuecat.com/docs/api-v2/subscription
 */
@Injectable()
export class RevenueCatStoreSubscriptionStatusAdapter extends StoreSubscriptionStatusReaderPort {
  readonly #logger = new Logger(RevenueCatStoreSubscriptionStatusAdapter.name);
  readonly #policy: OutboundPolicy;
  // 상품은 거의 바뀌지 않아 프로세스 안에서 한 번만 읽는다(Project Configuration 한도 60/분)
  readonly #storeProductIds = new Map<string, string>();
  readonly #http: HttpClient;
  readonly #config: Pick<BillingSubscriptionsConfig, "revenuecat">;

  constructor(
    @InjectHttpClient(REVENUECAT_HTTP_CLIENT) http: HttpClient,
    @Inject(billingSubscriptionsConfig.KEY) config: Pick<BillingSubscriptionsConfig, "revenuecat">,
    policies: OutboundPolicyRegistry,
  ) {
    super();
    this.#http = http;
    this.#config = config;
    this.#policy = policies.get(REVENUECAT_API_POLICY);
  }

  async read(storeSubscriptionIds: readonly string[]): Promise<StoreSubscriptionState[] | null> {
    const { apiV2SecretKey, projectId } = this.#config.revenuecat;
    if (apiV2SecretKey == null || projectId == null) {
      return null;
    }
    const states: StoreSubscriptionState[] = [];
    // 사용자당 체인이 몇 개뿐이라 순서대로 읽어 한도와 bulkhead를 아낀다
    for (const storeSubscriptionId of storeSubscriptionIds) {
      const subscription = await this.#findSubscription(projectId, storeSubscriptionId);
      if (subscription != null) {
        states.push({
          storeSubscriptionId,
          productId: await this.#storeProductIdOf(projectId, subscription.product_id),
          periodEndsAt:
            subscription.current_period_ends_at == null
              ? null
              : Temporal.Instant.fromEpochMilliseconds(subscription.current_period_ends_at),
          willRenew: RENEWING_STATUSES.has(subscription.auto_renewal_status),
          isTrial: subscription.status === "trialing",
          givesAccess: subscription.gives_access,
        });
      }
    }
    return states;
  }

  // 같은 거래 ID로 여러 개가 오면 접근을 주는 것, 그다음 늦게 끝나는 것을 고른다
  async #findSubscription(
    projectId: string,
    storeSubscriptionId: string,
  ): Promise<RevenueCatSubscription | undefined> {
    const list = await this.#get(
      `/projects/${encodeURIComponent(projectId)}/subscriptions`,
      { store_subscription_identifier: storeSubscriptionId },
      revenueCatSubscriptionListSchema,
    );
    return sortBy(list.items, [
      (item) => (item.gives_access ? 1 : 0),
      (item) => item.current_period_ends_at ?? 0,
    ]).at(-1);
  }

  async #storeProductIdOf(projectId: string, productId: string | null): Promise<string | null> {
    if (productId == null) {
      return null;
    }
    const cached = this.#storeProductIds.get(productId);
    if (cached != null) {
      return cached;
    }
    const product = await this.#get(
      `/projects/${encodeURIComponent(projectId)}/products/${encodeURIComponent(productId)}`,
      {},
      revenueCatProductSchema,
    );
    this.#storeProductIds.set(productId, product.store_identifier);
    return product.store_identifier;
  }

  async #get<TSchema extends z.ZodType>(
    path: string,
    query: Record<string, string>,
    schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    const outcome = await this.#policy.execute((signal) =>
      requestVendorJson(this.#http, `${REVENUECAT_API_BASE_URL}${path}`, query, {
        headers: { authorization: `Bearer ${this.#config.revenuecat.apiV2SecretKey ?? ""}` },
        signal,
        timeoutMs: REVENUECAT_TIMEOUT_MS,
      }),
    );
    if (outcome.kind === "http_failure") {
      throw new RevenueCatRequestError("http", outcome.statusCode);
    }
    const parsed = schema.safeParse(outcome.body);
    if (!parsed.success) {
      this.#logger.warn({
        event: RevenueCatLogEvent.RESPONSE_INVALID,
        issueCount: parsed.error.issues.length,
      });
      throw new RevenueCatRequestError("invalid_response", null);
    }
    return parsed.data;
  }
}
