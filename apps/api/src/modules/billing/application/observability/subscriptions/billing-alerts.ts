export const BillingAlertKey = {
  /** RevenueCat 웹훅을 처리하지 못했다. 응답은 200이라 RevenueCat이 다시 보내지 않는다. */
  WEBHOOK_PROCESSING_FAILED: "billing.subscription.webhook.processing-failed",
  /** 스토어 상태 대조가 재시도 뒤에도 실패했다. 키 권한·만료나 RevenueCat 장애를 봐야 한다. */
  RECONCILE_FAILED: "billing.subscription.reconcile.failed",
} as const;
