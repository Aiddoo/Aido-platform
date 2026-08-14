export const AI_SUGGESTION_QUEUE = "ai-suggestion-analysis.v1";
export const AI_SUGGESTION_LEGACY_QUEUE = "ai-suggestion-analysis";

/** 잡 이름 상수 */
export const AiSuggestionJobName = {
	DISPATCH: "dispatch-analysis",
	ANALYZE: "analyze-suggestion",
} as const;

export const AI_SUGGESTION_WORKER_POLICY = {
	teamSize: 5,
	pollingIntervalSeconds: 2,
} as const;

export const AiSuggestionRuntimeJobSchema = z.discriminatedUnion("name", [
	z.object({
		name: z.literal(AiSuggestionJobName.DISPATCH),
		data: z.object({}),
	}),
	z.object({
		name: z.literal(AiSuggestionJobName.ANALYZE),
		data: z.object({
			userId: z.string().min(1),
			timezone: z.string().min(1),
			weatherGrid: z
				.object({
					gridX: z.number(),
					gridY: z.number(),
					lat: z.number(),
					lon: z.number(),
				})
				.nullable(),
		}),
	}),
]);

/** per-user 제안 분석 잡 데이터 */
export interface AiSuggestionAnalyzeData {
	userId: string;
	timezone: string;
	/** 날씨 조회용 KMA 격자 좌표 (위치 미설정 시 null) */
	weatherGrid: {
		gridX: number;
		gridY: number;
		lat: number;
		lon: number;
	} | null;
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AiSuggestionJobMap {
	[AiSuggestionJobName.DISPATCH]: Record<string, never>;
	[AiSuggestionJobName.ANALYZE]: AiSuggestionAnalyzeData;
}

export type AiSuggestionJobData = AiSuggestionJobMap[keyof AiSuggestionJobMap];
export type AiSuggestionRuntimeJob = z.infer<
	typeof AiSuggestionRuntimeJobSchema
>;

import { z } from "zod";
