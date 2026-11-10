import { planTypeOfProduct, storeProductIdsOfPlan } from "./subscription-plan.domain-service.js";

describe("SubscriptionPlanDomainService", () => {
  it.each([
    { productId: "com.aido.pro.yearly", expected: "ANNUAL" },
    { productId: "com.aido.pro.monthly", expected: "MONTHLY" },
    { productId: "com.aido.pro.yearly:yearly-base", expected: "ANNUAL" },
    { productId: "com.aido.pro.monthly:monthly-base", expected: "MONTHLY" },
    { productId: "aido_premium_yearly", expected: null },
    { productId: "", expected: null },
  ])("상품 $productId의 요금제는 $expected다", ({ productId, expected }) => {
    // Given
    const storedProductId = productId;

    // When
    const planType = planTypeOfProduct(storedProductId);

    // Then
    expect(planType).toBe(expected);
  });

  it.each([
    { planType: "ANNUAL" as const, expected: ["com.aido.pro.yearly"] },
    { planType: "MONTHLY" as const, expected: ["com.aido.pro.monthly"] },
  ])("$planType 요금제의 스토어 상품 ID를 반환한다", ({ planType, expected }) => {
    // Given / When
    const productIds = storeProductIdsOfPlan(planType);

    // Then
    expect(productIds).toEqual(expected);
  });
});
