export const AUTH_LOG_EVENT = {
  PUSH_UNREGISTER_SKIPPED: 'auth.push-unregister.skipped',
  PUSH_UNREGISTER_FAILED: 'auth.push-unregister.failed',
  LOGOUT_API_FAILED: 'auth.logout-api.failed',
  LOGOUT_SERVER_SKIPPED_OFFLINE: 'auth.logout-server.skipped-offline',
  SESSION_CLEANUP_STEP_FAILED: 'auth.session-cleanup.step-failed',
} as const;
