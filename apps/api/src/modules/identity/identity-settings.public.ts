export type { UserConsentRecordWithId } from "./application/ports/settings/user-consent.repository.port.js";
export type { UserPreferenceRecordWithId } from "./application/ports/settings/user-preference.repository.port.js";
export {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  USER_SETTINGS_PROVISIONER,
  USER_STREAK_ACCESS,
  type UserNotificationSettingsAccessPort,
  type UserSettingsProvisionerPort,
  type UserStreakAccessPort,
} from "./application/ports/settings/user-settings-access.port.js";
export type { UserConsentRecord } from "./domain/records/settings/user-consent.record.js";
export type { UserPreferenceRecord } from "./domain/records/settings/user-preference.record.js";
export {
  computeEffectiveStreak,
  type EffectiveStreakResult,
} from "./domain/services/settings/effective-streak.js";
export { TimezoneSelfHealInterceptor } from "./presentation/interceptors/settings/timezone-self-heal.interceptor.js";
export { UserSettingsModule } from "./identity-settings.module.js";
