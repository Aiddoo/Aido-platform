import type { UserSettingsCachePort } from "./application/ports/user-settings-cache.port.js";

export { UserSettingsCachePort } from "./application/ports/user-settings-cache.port.js";

export type UserPreferenceCacheInvalidatorPort = Pick<
  UserSettingsCachePort,
  "invalidateUserPreference"
>;

export { AiDataSharingConsentReaderPort } from "./application/ports/ai-data-sharing-consent.reader.port.js";
export { AiDataSharingConsent } from "./domain/ai-data-sharing-consent.entity.js";
export { UserPreferenceReaderPort } from "./application/ports/user-preference.reader.port.js";
export type { PreferenceSnapshot } from "./application/read-models/preference.read-model.js";
export type { MarketingReconfirmTarget } from "./application/ports/user-consent.repository.port.js";
export type { UserConsentReadModel } from "./application/read-models/consent.read-model.js";
export type { UserPreferenceReadModel } from "./application/read-models/preference.read-model.js";
export {
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
  UserTimezoneReaderPort,
} from "./application/ports/user-settings-access.port.js";
export { computeEffectiveStreak } from "./domain/effective-streak.domain-service.js";
export {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "./domain/marketing-consent.domain-service.js";
// 사람 id 칸 옆에 발송 설정을 붙이는 다른 Context의 한 SQL이 설정 테이블을 직접 읽지 않게 한다
export {
  userDeliveryPreference,
  userMarketingPushConsent,
} from "./infrastructure/persistence/user-delivery-settings.query-fragment.js";
export { userReminderPreference } from "./infrastructure/persistence/user-reminder-preference.query-fragment.js";
export { userWeatherPreference } from "./infrastructure/persistence/user-weather-preference.query-fragment.js";
export { TimezoneSelfHealInterceptor } from "./presentation/http/interceptors/timezone-self-heal.interceptor.js";
export { IdentityUserPreferencesModule } from "./identity-user-preferences.module.js";
