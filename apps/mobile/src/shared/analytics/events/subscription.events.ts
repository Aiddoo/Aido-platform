export interface SubscriptionEventMap {
  subscription_started: { product_id: string };
  subscription_restored: undefined;
  premium_gate_shown: { feature: string };
}
