import { describe, expect, it } from "vitest";

import {
  revenueCatTransferWebhookPayloadSchema,
  revenueCatWebhookPayloadSchema,
} from "../src/contracts/subscription/index.js";

// RevenueCat 문서 샘플 TRANSFER: 구독자·상품 필드 없이 옮긴 app_user_id 목록만 온다
const DOCUMENTED_TRANSFER = {
  event: {
    app_id: "1234567890",
    event_timestamp_ms: 78_789_789_798_798,
    id: "CD489E0E-5D52-4E03-966B-A7F17788E432",
    store: "APP_STORE",
    transferred_from: ["00005A1C-6091-4F81-BE77-F0A83A271AB6"],
    transferred_to: ["4BEDB450-8EF2-11E9-B475-0800200C9A66"],
    type: "TRANSFER",
    environment: "PRODUCTION",
  },
  api_version: "1.0",
};

describe("RevenueCat 웹훅 계약", () => {
  it("문서 샘플 TRANSFER는 TRANSFER 스키마로 받고, 다른 이벤트 스키마는 app_user_id·product_id를 계속 요구한다", () => {
    // When
    const transfer = revenueCatTransferWebhookPayloadSchema.safeParse(DOCUMENTED_TRANSFER);
    const generic = revenueCatWebhookPayloadSchema.safeParse(DOCUMENTED_TRANSFER);

    // Then
    expect(transfer.success).toBe(true);
    expect(generic.success).toBe(false);
  });

  it("넘겨받은 사용자가 없는 TRANSFER와 다른 타입은 TRANSFER 스키마가 받지 않는다", () => {
    // When
    const results = [
      { ...DOCUMENTED_TRANSFER, event: { ...DOCUMENTED_TRANSFER.event, transferred_to: [] } },
      { ...DOCUMENTED_TRANSFER, event: { ...DOCUMENTED_TRANSFER.event, type: "RENEWAL" } },
    ].map((body) => revenueCatTransferWebhookPayloadSchema.safeParse(body).success);

    // Then
    expect(results).toEqual([false, false]);
  });

  it("BILLING_ISSUE의 결제 유예 끝은 숫자나 null로 받는다", () => {
    // When
    const results = [1_601_933_447_000, null].map(
      (grace) =>
        revenueCatWebhookPayloadSchema.safeParse({
          event: {
            type: "BILLING_ISSUE",
            app_user_id: "user-1",
            product_id: "com.revenuecat.myapp.monthly",
            grace_period_expiration_at_ms: grace,
          },
        }).success,
    );

    // Then
    expect(results).toEqual([true, true]);
  });
});
