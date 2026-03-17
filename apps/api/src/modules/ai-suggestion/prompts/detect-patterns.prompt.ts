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
 * 최근 할 일 목록에서 3가지 패턴(반복/순차/발전)을 감지하도록 AI에 요청합니다.
 *
 * 토큰 최적화: 압축 표기법 + 파이프 구분 입력 포맷
 */
export function buildDetectPatternsPrompt(
	todos: TodoSummaryForAnalysis[],
	minOccurrences: number,
): string {
	const todoLines = todos
		.map((t) => {
			const time = t.scheduledTime ?? "null";
			const done = t.completed ? "O" : "X";
			return `${t.startDate}|${sanitizeForPrompt(t.title)}|${time}|${done}|${t.categoryName}`;
		})
		.join("\n");

	return `할일 패턴 분석기. 최근 2주간 할일에서 3가지 패턴을 찾아 다음 할일을 예측해.

## 패턴 유형
1. 반복: 같은/유사 제목 ${minOccurrences}회+ 반복 → title=반복제목, daysOfWeek=반복요일
2. 순차: 번호/단계 진행 (1주차→2주차, 1장→2장, step1→step2) → title=다음단계 예측 (2회면 충분)
3. 발전: 수치/목표 증가 (3km→5km, 30분→45분, 절반→전부) → title=다음목표 예측 (2회면 충분)

## 규칙
- 요일패턴 분석→daysOfWeek, 시간있으면→scheduledTime(HH:mm)
- confidence: 반복(${minOccurrences}회+)=0.7~0.95, 순차/발전(2회)=0.5~0.7, (3회+)=0.7~0.9
- reason: 한국어, 왜 이 패턴이고 왜 이 title을 예측했는지 1문장
- matchedTitles: 매칭된 원본 제목들
- 최대5개, 없으면 빈배열
- title은 예측된 다음 할일 (반복=같은제목, 순차=다음단계, 발전=다음목표)
- 완료(O)된 항목이 많을수록 confidence 높임
- 같은 카테고리 내 항목끼리 우선 비교
- ★중요: 반복 패턴은 같은 제목이 ${minOccurrences}회 이상이어야만 인정. 2회만 반복된 동일 제목은 패턴이 아님
- ★중요: 순차/발전은 2회면 충분하지만, 단순 반복(같은 제목)은 절대 2회로 인정하지 마
- 1회만 등장한 항목은 절대 패턴 아님. 단발성 할일만 있으면 반드시 빈배열 반환

## 예시
입력:
2026-03-03|1주차 워크북|null|O|공부
2026-03-10|2주차 워크북|null|O|공부
2026-03-17|3주차 워크북|null|X|공부
→ title:"4주차 워크북", daysOfWeek:["MON"], confidence:0.85, reason:"매주 월요일 워크북이 순차 진행중 (1→2→3주차)", matchedTitles:["1주차 워크북","2주차 워크북","3주차 워크북"]

입력:
2026-03-05|달리기 3km|07:00|O|운동
2026-03-12|달리기 5km|07:00|O|운동
→ title:"달리기 7km", daysOfWeek:["WED"], scheduledTime:"07:00", confidence:0.6, reason:"수요일 아침 달리기 거리가 2km씩 증가하는 발전 패턴", matchedTitles:["달리기 3km","달리기 5km"]

입력:
2026-03-03|이사 견적 알아보기|null|O|일상
2026-03-07|치과 예약|14:00|O|건강
2026-03-10|생일 선물 사기|null|X|일상
→ [] (모두 1회씩만 등장 → 패턴 없음)

입력:
2026-03-03|장보기|null|O|일상
2026-03-10|장보기|null|O|일상
→ [] (같은 제목 2회뿐 → 반복 패턴 아님. 반복은 3회 이상 필요)

## 할일 기록 (날짜|제목|시간|완료|카테고리)
${todoLines}

JSON 형식으로 응답해.`;
}
