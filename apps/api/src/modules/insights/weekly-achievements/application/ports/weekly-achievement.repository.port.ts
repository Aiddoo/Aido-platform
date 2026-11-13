import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { IsoWeek } from "../../domain/iso-week.vo.js";
import type { WeeklyAchievementId } from "../../domain/weekly-achievement-id.vo.js";
import type { WeeklyAchievement } from "../../domain/weekly-achievement.aggregate.js";

export abstract class WeeklyAchievementRepositoryPort {
  abstract nextIds(count: number): Promise<WeeklyAchievementId[]>;
  /** 주 내림차순. afterWeek 주가 그 사용자·연도에 없으면 빈 목록이다 */
  abstract listByYear(params: {
    readonly userId: UserId;
    readonly year: number;
    readonly afterWeek: number | null;
    readonly limit: number;
  }): Promise<WeeklyAchievement[]>;
  /** 한 해 기록 전부(주 오름차순) */
  abstract listAllByYear(params: {
    readonly userId: UserId;
    readonly year: number;
  }): Promise<WeeklyAchievement[]>;
  abstract findByWeek(params: {
    readonly userId: UserId;
    readonly isoWeek: IsoWeek;
  }): Promise<WeeklyAchievement | null>;
  /**
   * 한 문장으로 모두 저장하고 하나라도 실패하면 아무것도 남기지 않는다.
   * 같은 사용자·주가 이미 있으면 처음 id를 두고 할 일 수·달성 시각만 바꾸며, 묶음 안 같은 주는 마지막 값이 이긴다
   */
  abstract saveAll(achievements: readonly WeeklyAchievement[]): Promise<void>;
}
