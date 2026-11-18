import {
  weeklyAchievementDetailResponseSchema,
  weeklyAchievementListResponseSchema,
  weeklyAchievementYearsResponseSchema,
} from '@aido/api/contracts/weekly-achievement/v1';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { GetAchievementsQuery } from '../schemas/achievement-list-request.schema';
import {
  toAchievementYears,
  toWeeklyAchievement,
  toWeeklyAchievementPage,
} from './achievement.mapper';

export class AchievementApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getWeeklyAchievements = async (
    { year, cursor, size }: GetAchievementsQuery,
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.get('v1/weekly-achievements', {
        signal,
        params: { year, cursor, size },
      }),
      weeklyAchievementListResponseSchema,
      toWeeklyAchievementPage,
      '[AchievementApi] Invalid getWeeklyAchievements response',
    );

  getWeeklyAchievementYears = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/weekly-achievements/years', { signal }),
      weeklyAchievementYearsResponseSchema,
      toAchievementYears,
      '[AchievementApi] Invalid getWeeklyAchievementYears response',
    );

  getWeeklyAchievement = async (year: number, week: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/weekly-achievements/${year}/${week}`, { signal }),
      weeklyAchievementDetailResponseSchema,
      toWeeklyAchievement,
      '[AchievementApi] Invalid getWeeklyAchievement response',
    );
}
