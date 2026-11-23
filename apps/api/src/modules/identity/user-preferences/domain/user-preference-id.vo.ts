import { EntityId } from "#api/shared/domain/model/entity-id";

// 사용자마다 설정이 하나라 값은 그 사용자 id다(UserPreference·UserConsent 행의 키가 userId)
export class UserPreferenceId extends EntityId<string> {
  static reconstitute(value: string): UserPreferenceId {
    return new UserPreferenceId(value);
  }
}
