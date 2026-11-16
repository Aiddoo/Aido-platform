import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SuggestionAnalysisTrigger } from "../../domain/suggestion-analysis.constants.js";

export interface SuggestionWeatherGrid {
  readonly gridX: number;
  readonly gridY: number;
  readonly lat: number;
  readonly lon: number;
}

export interface SuggestionAnalysisJob {
  readonly userId: UserId;
  readonly localDate: Temporal.PlainDate;
  readonly trigger: SuggestionAnalysisTrigger;
  readonly timeZone: string;
  // 배포가 겹치는 동안 옛 worker가 날씨 문맥에 쓴다. 새 worker는 읽지 않는다
  readonly weatherGrid: SuggestionWeatherGrid | null;
}

export abstract class SuggestionAnalysisEnqueuerPort {
  abstract enqueue(job: SuggestionAnalysisJob): Promise<void>;
  abstract enqueueMany(jobs: readonly SuggestionAnalysisJob[]): Promise<void>;
}
