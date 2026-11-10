import type { PreferenceSnapshot } from "../read-models/preference.read-model.js";

export const USER_PREFERENCE_READER = Symbol("USER_PREFERENCE_READER");

export interface UserPreferenceReaderPort {
  read(userId: string): Promise<PreferenceSnapshot>;
}
