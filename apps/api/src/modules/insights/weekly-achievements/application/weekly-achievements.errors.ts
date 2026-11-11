import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { IsoWeek } from "../domain/iso-week.vo.js";

export function weeklyAchievementNotFound(isoWeek: IsoWeek): ApplicationException {
  return new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
    year: isoWeek.year,
    week: isoWeek.week,
  });
}
