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
 * 최근 할 일 목록에서 5가지 패턴(반복/순차/발전/습관 강화/재도전)을 감지하도록 AI에 요청합니다.
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

	return `너는 사용자의 루틴 코치야. 최근 2주간 할일 데이터를 분석해서 습관 개선에 도움이 되는 제안을 해줘.

## 분석 절차
먼저 아래 데이터를 보고 내부적으로 다음을 파악해:
1. 카테고리별 완료율 (O 횟수 / 전체 횟수)
2. 요일별·시간대별 활동 선호도
3. 어떤 활동이 꾸준히 되고, 어떤 활동이 잘 안 되는지
이 분석을 바탕으로 아래 5가지 패턴을 찾아.

## 패턴 유형
1. **반복**: 같은/유사 제목 ${minOccurrences}회+ 반복 → title=반복제목, daysOfWeek=반복요일
2. **순차**: 번호/단계 진행 (1주차→2주차, 1장→2장, step1→step2) → title=다음단계 예측 (2회면 충분)
3. **발전**: 수치/목표 증가 (3km→5km, 30분→45분) → title=다음목표 예측 (2회면 충분)
4. **습관 강화**: 완료율 70%+ 활동인데 특정 요일에만 하는 경우 → 빈 요일에 추가하거나 빈도 증가 제안
5. **재도전**: 완료율 50% 미만 활동 → 더 가벼운 버전(시간 단축, 난이도 하향) 또는 다른 시간대 제안

## confidence 기준
| 조건 | confidence |
|------|-----------|
| 반복 ${minOccurrences}회+ & 완료율 >80% | 0.85-0.95 |
| 반복 ${minOccurrences}회+ & 완료율 50-80% | 0.65-0.85 |
| 순차/발전 & 완료율 높음 | 0.7-0.85 |
| 습관 강화 (고완료율 활동) | 0.6-0.8 |
| 재도전 (저완료율 활동) | 0.5-0.65 |

## reason 작성 규칙
reason은 반드시 "[관찰] + [제안]" 2파트로 구성해:
- 관찰: 사용자의 실제 데이터를 언급 (완료 횟수, 요일, 완료율 등)
- 제안: 왜 이 title을 추천하는지 동기부여가 되는 톤으로
- 격려하는 톤 사용, 딱딱한 분석 보고서 톤 금지

## 규칙
- 요일패턴 분석→daysOfWeek, 시간있으면→scheduledTime(HH:mm)
- matchedTitles: 매칭된 원본 제목들
- 최대 5개, 없으면 빈배열
- title은 예측된 다음 할일 (반복=같은제목, 순차=다음단계, 발전=다음목표, 습관강화=같은제목/빈요일, 재도전=가벼운버전)
- 같은 카테고리 내 항목끼리 우선 비교
- ★중요: 반복 패턴은 같은 제목이 ${minOccurrences}회 이상이어야만 인정. 2회만 반복된 동일 제목은 패턴이 아님
- ★중요: 순차/발전은 2회면 충분하지만, 단순 반복(같은 제목)은 절대 2회로 인정하지 마
- ★중요: 습관 강화는 해당 활동이 최소 ${minOccurrences}회 이상 등장하고 완료율이 70% 이상이어야 함
- ★중요: 재도전은 해당 활동이 최소 ${minOccurrences}회 이상 등장하고 완료율이 50% 미만이어야 함
- 1회만 등장한 항목은 절대 패턴 아님. 단발성 할일만 있으면 반드시 빈배열 반환

## 예시

입력:
2026-03-03|1주차 워크북|null|O|공부
2026-03-10|2주차 워크북|null|O|공부
2026-03-17|3주차 워크북|null|X|공부
→ title:"4주차 워크북", daysOfWeek:["MON"], confidence:0.8, reason:"매주 월요일 워크북을 빠짐없이 하고 계시네요! 4주차로 넘어갈 차례예요.", matchedTitles:["1주차 워크북","2주차 워크북","3주차 워크북"]

입력:
2026-03-05|달리기 3km|07:00|O|운동
2026-03-12|달리기 5km|07:00|O|운동
→ title:"달리기 7km", daysOfWeek:["WED"], scheduledTime:"07:00", confidence:0.7, reason:"수요일 아침 달리기 거리를 꾸준히 늘리고 계시네요! 이번엔 7km에 도전해보세요.", matchedTitles:["달리기 3km","달리기 5km"]

입력:
2026-03-03|달리기|07:00|O|운동
2026-03-05|달리기|07:00|O|운동
2026-03-10|달리기|07:00|O|운동
2026-03-12|달리기|07:00|O|운동
→ title:"달리기", daysOfWeek:["MON","WED","FRI"], scheduledTime:"07:00", confidence:0.7, reason:"월·수요일 아침 달리기를 100% 완료하고 계세요! 금요일에도 추가하면 주 3회 루틴이 완성돼요.", matchedTitles:["달리기","달리기","달리기","달리기"]
(습관 강화: 월/수만 하던 것을 금요일에도 추가 제안)

입력:
2026-03-03|독서 1시간|22:00|X|자기계발
2026-03-07|독서 1시간|22:00|O|자기계발
2026-03-10|독서 1시간|22:00|X|자기계발
2026-03-14|독서 1시간|22:00|X|자기계발
→ title:"독서 30분", daysOfWeek:["MON","FRI"], scheduledTime:"20:00", confidence:0.55, reason:"독서를 자주 계획하시지만 완료가 어려운 것 같아요. 시간을 줄이고 좀 더 이른 시간에 시작해보는 건 어떨까요?", matchedTitles:["독서 1시간","독서 1시간","독서 1시간","독서 1시간"]
(재도전: 완료율 25%인 활동을 가벼운 버전으로 제안)

입력:
2026-03-03|이사 견적 알아보기|null|O|일상
2026-03-07|치과 예약|14:00|O|건강
2026-03-10|생일 선물 사기|null|X|일상
→ [] (모두 1회씩만 등장 → 패턴 없음)

입력:
2026-03-03|장보기|null|O|일상
2026-03-10|장보기|null|O|일상
→ [] (같은 제목 2회뿐 → 반복 패턴 아님. 반복은 ${minOccurrences}회 이상 필요)

## 할일 기록 (날짜|제목|시간|완료|카테고리)
${todoLines}

JSON 형식으로 응답해.`;
}
