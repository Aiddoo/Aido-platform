import type { PreferenceSnapshot } from "../../read-models/settings/preference.read-model.js";

export const USER_PREFERENCE_READER = Symbol("USER_PREFERENCE_READER");

export interface UserPreferenceReaderPort {
  read(userId: string): Promise<PreferenceSnapshot>;
}
