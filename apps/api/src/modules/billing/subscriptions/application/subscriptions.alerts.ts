export const SubscriptionAlertKey = {
  /** 다시 보내도 같은 영구 실패(사용자·체인·필수 값 없음)라 받은 것으로 닫았다. 일시 실패는 공급자가 다시 보낸다. */
  WEBHOOK_PROCESSING_FAILED: "billing.subscription.webhook.processing-failed",
  /** 계약과 다른 웹훅 원문을 받았다. 다시 보내도 같으므로 받은 것으로 닫는다. */
  WEBHOOK_INVALID: "billing.subscription.webhook.invalid",
  /** 스토어 상태 대조가 재시도 뒤에도 실패했다. 키 권한·만료나 RevenueCat 장애를 봐야 한다. */
  RECONCILE_FAILED: "billing.subscription.reconcile.failed",
} as const;
