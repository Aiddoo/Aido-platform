import type { PreferenceSnapshot } from "../read-models/preference.read-model.js";

export abstract class UserPreferenceReaderPort {
  abstract read(userId: string): Promise<PreferenceSnapshot>;
}
