import type { PreferenceSnapshot } from "../read-models/preference.read-model.js";

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_PREFERENCE_READER = Symbol("USER_PREFERENCE_READER");

export abstract class UserPreferenceReaderPort {
  abstract read(userId: string): Promise<PreferenceSnapshot>;
}
