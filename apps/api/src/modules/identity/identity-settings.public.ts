import type { UserSettingsCachePort } from "./preferences/application/ports/user-settings-cache.port.js";

export { UserSettingsCachePort } from "./preferences/application/ports/user-settings-cache.port.js";

export type UserPreferenceCacheInvalidatorPort = Pick<
  UserSettingsCachePort,
  "invalidateUserPreference"
>;

export { AiDataSharingConsentReaderPort } from "./preferences/application/ports/ai-data-sharing-consent.reader.port.js";
export { AiDataSharingConsent } from "./preferences/domain/ai-data-sharing-consent.entity.js";
export { UserPreferenceReaderPort } from "./preferences/application/ports/user-preference.reader.port.js";
export type { PreferenceSnapshot } from "./preferences/application/read-models/preference.read-model.js";
export type {
  MarketingReconfirmTarget,
  UserConsentRecordWithId,
} from "./preferences/application/ports/user-consent.repository.port.js";
export type { UserPreferenceRecordWithId } from "./preferences/application/ports/user-preference.repository.port.js";
export {
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
  UserTimezoneReaderPort,
} from "./preferences/application/ports/user-settings-access.port.js";
export type { UserConsentRecord } from "./preferences/domain/user-consent.constants.js";
export type { UserPreferenceRecord } from "./preferences/domain/user-preference.constants.js";
export { computeEffectiveStreak } from "./preferences/domain/effective-streak.domain-service.js";
export {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "./preferences/domain/marketing-consent.domain-service.js";
export { TimezoneSelfHealInterceptor } from "./preferences/presentation/http/interceptors/timezone-self-heal.interceptor.js";
export { IdentityPreferencesModule as IdentitySettingsModule } from "./preferences/identity-preferences.module.js";
