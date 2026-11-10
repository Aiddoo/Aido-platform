import { STORE_SUBSCRIPTION_PRODUCTS, type SubscriptionPlanType } from "@aido/api/vocabulary";

const PLAN_TYPE_BY_STORE_PRODUCT: ReadonlyMap<string, SubscriptionPlanType> = new Map(
  Object.entries(STORE_SUBSCRIPTION_PRODUCTS),
);

/** 저장한 상품 ID의 요금제. Play 구독은 "상품:기본요금제"로 오므로 ':' 앞만 본다. 모르는 상품이면 null이다. */
export function planTypeOfProduct(productId: string): SubscriptionPlanType | null {
  const [storeProductId = productId] = productId.split(":");
  return PLAN_TYPE_BY_STORE_PRODUCT.get(storeProductId) ?? null;
}

/** 이 요금제의 스토어 상품 ID(':' 앞) */
export function storeProductIdsOfPlan(planType: SubscriptionPlanType): string[] {
  return [...PLAN_TYPE_BY_STORE_PRODUCT].flatMap(([productId, type]) =>
    type === planType ? [productId] : [],
  );
}
