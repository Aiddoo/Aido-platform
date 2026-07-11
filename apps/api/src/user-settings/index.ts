export {
	type DefaultSettingsConsent,
	type UserConsentRecordWithId,
	type UserPreferenceRecordWithId,
	UserSettingsFacade,
} from "./application/facades/user-settings.facade";
export type { UserConsentRecord } from "./domain/records/user-consent.record";
export type { UserPreferenceRecord } from "./domain/records/user-preference.record";
export {
	computeEffectiveStreak,
	type EffectiveStreakResult,
} from "./domain/services/effective-streak";
export { UserSettingsModule } from "./user-settings.module";
