export const SUBSCRIPTION_LOG_EVENT = {
  OFFERINGS_FETCH_FAILED: 'subscription.offerings-fetch.failed',
  STORE_UNAVAILABLE: 'subscription.store.unavailable',
  CUSTOMER_INFO_FETCH_FAILED: 'subscription.customer-info-fetch.failed',
  PURCHASES_CONFIGURE_SKIPPED: 'subscription.revenuecat-configure.skipped',
  PURCHASES_CONFIGURE_FAILED: 'subscription.revenuecat-configure.failed',
  PURCHASES_LOGIN_FAILED: 'subscription.revenuecat-login.failed',
  PURCHASES_LOGOUT_FAILED: 'subscription.revenuecat-logout.failed',
  PURCHASES_ACCOUNT_NOT_SIGNED_IN: 'subscription.purchases-account.not-signed-in',
  PREMIUM_ENDED_REFRESH_FAILED: 'subscription.premium-ended-refresh.failed',
  PURCHASES_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED:
    'subscription.revenuecat-subscriber-attributes-sync.failed',
  PURCHASES_ANALYTICS_ID_SYNC_FAILED:
    'subscription.revenuecat-firebase-app-instance-id-sync.failed',
} as const;
