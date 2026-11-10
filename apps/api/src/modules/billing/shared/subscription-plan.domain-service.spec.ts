import { planTypeOfProduct } from "./subscription-plan.domain-service.js";

describe("SubscriptionPlanPolicy", () => {
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
});
