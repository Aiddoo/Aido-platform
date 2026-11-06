import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { AchievementPaginationParams } from '../schemas/achievement.schema';
import { toWeeklyAchievement, toWeeklyAchievementsResult } from './achievement.mapper';

export class AchievementService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getWeeklyAchievements = async (
    { year, cursor, size }: AchievementPaginationParams,
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.get('v1/weekly-achievements', {
        signal,
        params: { year, cursor, size },
      }),
      weeklyAchievementListResponseSchema,
      toWeeklyAchievementsResult,
      '[AchievementService] Invalid getWeeklyAchievements response',
    );

  getWeeklyAchievement = async (year: number, week: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/weekly-achievements/${year}/${week}`, { signal }),
      weeklyAchievementDetailResponseSchema,
      toWeeklyAchievement,
      '[AchievementService] Invalid getWeeklyAchievement response',
    );
}
