import { z } from "zod";
import { sanitizeForPrompt } from "../../ai/prompts/sanitize";
import type { TodoSummaryForAnalysis } from "../types";

/**
 * AI 패턴 감지 응답 스키마
 */
export const detectedPatternsSchema = z.object({
	patterns: z.array(
		z.object({
			title: z.string().describe("반복 할 일의 제목"),
			daysOfWeek: z
				.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]))
				.describe("반복 요일 (예: ['MON', 'WED', 'FRI'])"),
			scheduledTime: z
				.string()
				.nullable()
				.describe("예약 시간 (HH:mm 형식, 없으면 null)"),
			confidence: z.number().min(0).max(1).describe("패턴 확신도 (0.0~1.0)"),
			reason: z.string().describe("이 패턴을 감지한 이유 (한국어, 1-2문장)"),
			matchedTitles: z
				.array(z.string())
				.describe("이 패턴과 매칭된 원본 할 일 제목들"),
		}),
	),
});

export type DetectedPatternsResponse = z.infer<typeof detectedPatternsSchema>;

/**
 * 패턴 감지 프롬프트 생성
 *
 * 최근 할 일 목록에서 반복 패턴을 감지하도록 AI에 요청합니다.
 */
export function buildDetectPatternsPrompt(
	todos: TodoSummaryForAnalysis[],
	minOccurrences: number,
): string {
	const todoLines = todos
		.map((t) => {
			const time = t.scheduledTime ? ` (${t.scheduledTime})` : "";
			return `- ${t.startDate}: ${sanitizeForPrompt(t.title)}${time}`;
		})
		.join("\n");

	return `너는 사용자의 할 일 패턴을 분석하는 AI야.
아래는 최근 2주간의 할 일 기록이야. 같은 할 일이 ${minOccurrences}회 이상 비슷한 스케줄로 반복된 패턴을 찾아줘.

## 할 일 기록
${todoLines}

## 규칙
1. 동일하거나 매우 유사한 제목의 할 일이 ${minOccurrences}회 이상 나타난 경우에만 패턴으로 인식해.
2. 요일 패턴을 분석해서 어떤 요일에 반복되는지 파악해.
3. 시간 정보가 있으면 scheduledTime에 HH:mm 형식으로 넣어줘.
4. confidence는 패턴의 확신도야 (0.7 이상이면 강한 패턴).
5. reason은 한국어로 왜 이 패턴을 감지했는지 간단히 설명해.
6. matchedTitles에는 이 패턴과 매칭된 원본 할 일 제목들을 넣어.
7. 최대 5개의 패턴만 반환해.
8. 패턴이 없으면 빈 배열을 반환해.

JSON 형식으로 응답해.`;
}
