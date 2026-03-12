import {
  type WeeklyAchievementDetailResponse,
  type WeeklyAchievementListResponse,
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  AchievementPaginationParams,
  WeeklyAchievement,
  WeeklyAchievementsResult,
} from '../models/achievement.model';
import { toWeeklyAchievement, toWeeklyAchievementsResult } from './achievement.mapper';

export class AchievementService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getWeeklyAchievements = async (
    params: AchievementPaginationParams,
  ): Promise<Result<WeeklyAchievementsResult, ApiError>> => {
    const result = await this.#httpClient.get<WeeklyAchievementListResponse>(
      'v1/weekly-achievements',
      {
        params: {
          year: params.year,
          cursor: params.cursor,
          size: params.size,
        },
      },
    );

    if (!result.ok) return result;

    const parsed = weeklyAchievementListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AchievementService] Invalid getWeeklyAchievements response: ${parsed.error.message}`,
      );
    }

    return ok(toWeeklyAchievementsResult(parsed.data));
  };

  getWeeklyAchievement = async (
    year: number,
    week: number,
  ): Promise<Result<WeeklyAchievement, ApiError>> => {
    const result = await this.#httpClient.get<WeeklyAchievementDetailResponse>(
      `v1/weekly-achievements/${year}/${week}`,
    );

    if (!result.ok) return result;

    const parsed = weeklyAchievementDetailResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AchievementService] Invalid getWeeklyAchievement response: ${parsed.error.message}`,
      );
    }

    return ok(toWeeklyAchievement(parsed.data));
  };
}
