import type { UserSettingsCachePort } from "./application/ports/settings/user-settings-cache.port.js";

export { USER_SETTINGS_CACHE } from "./application/ports/settings/user-settings-cache.port.js";
export type UserPreferenceCacheInvalidatorPort = Pick<
  UserSettingsCachePort,
  "invalidateUserPreference"
>;

export {
  AI_DATA_SHARING_CONSENT_READER,
  type AiDataSharingConsentReaderPort,
} from "./application/ports/settings/ai-data-sharing-consent.reader.port.js";
export {
  USER_PREFERENCE_READER,
  type UserPreferenceReaderPort,
} from "./application/ports/settings/user-preference.reader.port.js";
export type { PreferenceSnapshot } from "./application/read-models/settings/preference.read-model.js";
export type {
  FindMarketingReconfirmTargetsParams,
  MarketingReconfirmTarget,
  UserConsentRecordWithId,
} from "./application/ports/settings/user-consent.repository.port.js";
export type { UserPreferenceRecordWithId } from "./application/ports/settings/user-preference.repository.port.js";
export {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  USER_SETTINGS_PROVISIONER,
  USER_STREAK_ACCESS,
  USER_TIMEZONE_READER,
  type UserNotificationSettingsAccessPort,
  type UserSettingsProvisionerPort,
  type UserStreakAccessPort,
  type UserTimezoneReaderPort,
} from "./application/ports/settings/user-settings-access.port.js";
export type { UserConsentRecord } from "./domain/records/settings/user-consent.record.js";
export type { UserPreferenceRecord } from "./domain/records/settings/user-preference.record.js";
export { computeEffectiveStreak } from "./domain/services/settings/effective-streak.js";
export {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "./domain/services/settings/marketing-consent-policy.js";
export { TimezoneSelfHealInterceptor } from "./presentation/interceptors/settings/timezone-self-heal.interceptor.js";
export { IdentitySettingsModule } from "./identity-settings.module.js";
