import { HttpClient } from "@nestjs/http-client";
import type { MockInstance } from "vitest";

import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  RevenueCatRequestError,
  RevenueCatStoreSubscriptionStatusAdapter,
} from "./revenuecat-store-subscription-status.adapter.js";

const PROJECT_ID = "proj1ab2c3d4";
const CHAIN_ID = "GPA.1234-5678-9012-34567";
const PERIOD_ENDS_AT_MS = 1_893_456_000_000;

// RevenueCat REST v2 문서의 Subscription 예시(https://www.revenuecat.com/docs/api-v2/subscription-data-model)
const SUBSCRIPTION_LIST = {
  object: "list",
  items: [
    {
      object: "subscription",
      id: "sub1ab2c3d4e5",
      customer_id: "19b8de26-77c1-49f1-aa18-019a391603e2",
      original_customer_id: "19b8de26-77c1-49f1-aa18-019a391603e2",
      product_id: "prod1a2b3c4d5e",
      starts_at: 1_658_399_423_658,
      current_period_starts_at: 1_658_399_423_658,
      current_period_ends_at: PERIOD_ENDS_AT_MS,
      ends_at: PERIOD_ENDS_AT_MS,
      gives_access: true,
      pending_payment: false,
      auto_renewal_status: "will_renew",
      status: "trialing",
      environment: "production",
      store: "play_store",
      store_subscription_identifier: "GPA.1234-5678-9012-34567..0",
      ownership: "purchased",
      country: "US",
      management_url: "https://play.google.com/store/account/subscriptions",
      entitlements: { object: "list", items: [], next_page: null, url: "/v2/..." },
      pending_changes: null,
    },
  ],
  next_page: null,
  url: `/v2/projects/${PROJECT_ID}/subscriptions`,
};

const PRODUCT = {
  object: "product",
  id: "prod1a2b3c4d5e",
  store_identifier: "com.aido.pro.yearly:yearly-base",
  type: "subscription",
  state: "active",
  app_id: "app1a2b3c4",
  created_at: 1_658_399_423_658,
  display_name: "Aido Pro Yearly",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createAdapter(revenuecat: { apiV2SecretKey?: string; projectId?: string }) {
  return new RevenueCatStoreSubscriptionStatusAdapter(
    new HttpClient({ retry: false, throwOnHttpError: false }),
    {
      revenuecat: {
        apiV2SecretKey: revenuecat.apiV2SecretKey,
        projectId: revenuecat.projectId,
      },
    },
    new OutboundPolicyRegistry(new RecordingOperationalAlert()),
  );
}

describe("RevenueCatStoreSubscriptionStatusAdapter — RevenueCat v2 구독 상태 읽기", () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    suppressLogger();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("우리 체인 키로 찾은 문서 예시 응답을 대조 상태로 바꾸고 상품은 스토어 식별자로 읽는다", async () => {
    // Given
    fetchSpy.mockImplementation(async (input) =>
      String(input).includes("/products/") ? json(PRODUCT) : json(SUBSCRIPTION_LIST),
    );
    const reader = createAdapter({ apiV2SecretKey: "sk_test", projectId: PROJECT_ID });

    // When
    const states = await reader.read([CHAIN_ID]);

    // Then
    expect(states).toEqual([
      {
        storeSubscriptionId: CHAIN_ID,
        productId: "com.aido.pro.yearly:yearly-base",
        periodEndsAt: Temporal.Instant.fromEpochMilliseconds(PERIOD_ENDS_AT_MS),
        willRenew: true,
        isTrial: true,
        givesAccess: true,
      },
    ]);
    const searchUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(searchUrl.pathname).toBe(`/v2/projects/${PROJECT_ID}/subscriptions`);
    expect(searchUrl.searchParams.get("store_subscription_identifier")).toBe(CHAIN_ID);
  });

  it("비밀 키나 프로젝트 ID가 없으면 호출하지 않고 null이다", async () => {
    // Given
    const reader = createAdapter({ projectId: PROJECT_ID });

    // When
    const states = await reader.read([CHAIN_ID]);

    // Then
    expect(states).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    { name: "5xx", response: () => json({ type: "server_error" }, 503) },
    { name: "형식이 다른 응답", response: () => json({ object: "list", items: [{ id: 1 }] }) },
  ])("$name이면 던져 잡이 다시 시도하게 한다", async ({ response }) => {
    // Given
    fetchSpy.mockImplementation(async () => response());
    const reader = createAdapter({ apiV2SecretKey: "sk_test", projectId: PROJECT_ID });

    // When
    const reading = reader.read([CHAIN_ID]);

    // Then
    await expect(reading).rejects.toBeInstanceOf(RevenueCatRequestError);
  });
});
