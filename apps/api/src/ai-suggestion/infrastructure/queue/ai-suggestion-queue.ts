export const AI_SUGGESTION_QUEUE = "ai-suggestion-analysis.v1";
export const AI_SUGGESTION_LEGACY_QUEUE = "ai-suggestion-analysis";

/** 잡 이름 상수 */
export const AiSuggestionJobName = {
	DISPATCH: "dispatch-analysis",
	ANALYZE: "analyze-suggestion",
} as const;

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
