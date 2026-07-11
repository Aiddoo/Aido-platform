export {
	type DefaultSettingsConsent,
	UserSettingsFacade,
} from "./application/facades/user-settings.facade";
export type { UserConsentRecordWithId } from "./application/ports/user-consent.repository.port";
export type { UserPreferenceRecordWithId } from "./application/ports/user-preference.repository.port";
export type { UserConsentRecord } from "./domain/records/user-consent.record";
export type { UserPreferenceRecord } from "./domain/records/user-preference.record";
export {
	computeEffectiveStreak,
	type EffectiveStreakResult,
} from "./domain/services/effective-streak";
export { UserSettingsModule } from "./user-settings.module";
