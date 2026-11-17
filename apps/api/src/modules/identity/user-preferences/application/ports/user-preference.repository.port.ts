import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserPreference } from "../../domain/user-preference.aggregate.js";
import type { UserPreferenceReadModel } from "../read-models/preference.read-model.js";

export abstract class UserPreferenceRepositoryPort {
  /** 설정·동의 행이 없으면 그 부분은 기본값이다(옛 사용자). 저장할 때 바꾼 칸으로 행을 만든다 */
  abstract getByUserId(userId: UserId): Promise<UserPreference>;
  abstract findReadModelByUserId(userId: UserId): Promise<UserPreferenceReadModel | null>;
  abstract findReadModelsByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceReadModel[]>;
  /**
   * 읽은 뒤 바뀐 칸만 쓰고 없는 행은 만든다. 다른 요청이 쓴 칸(연속 완료·재확인 시각)을 덮지 않는다.
   * 연속 완료는 읽은 값이 그대로일 때만 쓰고 아니면 false다
   */
  abstract save(preference: UserPreference): Promise<boolean>;
  /**
   * 저장된 시간대가 다를 때만 바꾸고 바꾼 행 수를 준다. 요청마다 도는 자가치유라 잠금 없이 한 칸만
   * 조건부로 쓴다. 행이 없으면 만들지 않는다(기기 등록이 만든다)
   */
  abstract refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number>;
}
