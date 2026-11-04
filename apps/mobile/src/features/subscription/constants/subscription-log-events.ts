export const SUBSCRIPTION_LOG_EVENT = {
  OFFERINGS_FETCH_FAILED: 'subscription.offerings-fetch.failed',
  STORE_UNAVAILABLE: 'subscription.store.unavailable',
  CUSTOMER_INFO_FETCH_FAILED: 'subscription.customer-info-fetch.failed',
  REVENUECAT_CONFIGURE_SKIPPED: 'subscription.revenuecat-configure.skipped',
  REVENUECAT_CONFIGURE_FAILED: 'subscription.revenuecat-configure.failed',
  REVENUECAT_LOGIN_FAILED: 'subscription.revenuecat-login.failed',
  REVENUECAT_LOGOUT_FAILED: 'subscription.revenuecat-logout.failed',
  PREMIUM_ENDED_REFRESH_FAILED: 'subscription.premium-ended-refresh.failed',
  REVENUECAT_SUBSCRIBER_ATTRIBUTES_SYNC_FAILED:
    'subscription.revenuecat-subscriber-attributes-sync.failed',
  REVENUECAT_FIREBASE_APP_INSTANCE_ID_SYNC_FAILED:
    'subscription.revenuecat-firebase-app-instance-id-sync.failed',
  ENTITLEMENT_SNAPSHOT_MAPPING_FAILED: 'entitlement.snapshot.mapping-failed',
} as const;
