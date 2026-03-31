import { dayOfWeekSchema } from "@aido/validators";
import { z } from "zod";
import { sanitizeForPrompt } from "../../ai/prompts/sanitize";
import type { SuggestionContext } from "../types";

/**
 * AI 패턴 감지 응답 스키마
 */
export const detectedPatternsSchema = z.object({
	patterns: z.array(
		z.object({
			title: z.string().describe("반복 할 일의 제목"),
			daysOfWeek: z
				.array(dayOfWeekSchema)
				.describe("반복 요일 (예: ['MON', 'WED', 'FRI'])"),
			scheduledTime: z
				.string()
				.nullable()
				.describe("예약 시간 (HH:mm 형식, 없으면 null)"),
			confidence: z.number().min(0).max(1).describe("패턴 확신도 (0.0~1.0)"),
			reason: z.string().describe("이 패턴을 감지한 이유 (한국어, 1-2문장)"),
			matchedTitles: z
				.array(z.string())
				.describe("이 패턴과 매칭된 원본 할 일 제목들 (시즌 추천은 빈 배열)"),
		}),
	),
});

export type DetectedPatternsResponse = z.infer<typeof detectedPatternsSchema>;

/**
 * AI 제안 프롬프트 생성
 *
 * 사전 계산된 컨텍스트 + 원시 투두 데이터를 기반으로
 * 6가지 유형의 맞춤 루틴 제안을 생성하도록 AI에 요청합니다.
 */
export function buildSuggestionPrompt(
	context: SuggestionContext,
	minOccurrences: number,
): string {
	const todoLines = context.todos
		.map((t) => {
			const time = t.scheduledTime ?? "null";
			const done = t.completed ? "O" : "X";
			return `${t.startDate}|${sanitizeForPrompt(t.title)}|${time}|${done}|${t.categoryName}`;
		})
		.join("\n");

	const weatherSection = context.weather
		? `\n## 오늘 날씨\n${context.weather}\n`
		: "";

	const missingRoutinesText =
		context.missingRoutines.length > 0
			? context.missingRoutines.join("\n")
			: "없음";

	return `너는 사용자의 루틴 코치야. 아래 분석 데이터와 할일 기록을 보고 맞춤 루틴을 제안해줘.

## 사용자 프로필
연속 달성: ${context.streak}
오늘: ${context.currentDate}

## 요일별 완료율
${context.dayCompletionRates}

## 시간대별 완료율
${context.timeCompletionRates}

## 카테고리별 완료율
${context.categoryRates}

## 빠뜨린 루틴 (이번 주에 빠진 정기 활동)
${missingRoutinesText}
${weatherSection}
## 제안 유형 (6가지 중 최대 5개 선택, 다양하게 섞어서)

1. **빠뜨린 루틴 리마인드**: "빠뜨린 루틴" 섹션에 항목이 있으면, 해당 활동을 반복 루틴으로 제안
   - matchedTitles: 해당 활동의 원본 제목들
   - confidence: 0.75-0.90

2. **시간대 루틴**: 오전/오후 완료율 차이가 크면, 완료율 높은 시간대에 새 루틴 제안
   - title: 사용자의 기존 카테고리/활동 기반 새 루틴 (예: "아침 독서 30분")
   - scheduledTime: 완료율 높은 시간대 (오전이면 08:00~11:00, 오후면 14:00~17:00)
   - matchedTitles: 참고한 기존 할 일 제목들
   - confidence: 0.60-0.80

3. **날씨 대비 루틴**: 비/눈 예보가 있으면, 악천후 대비 실내 대안 루틴 제안
   - title: 기존 야외 활동의 실내 대안 (예: "실내 스트레칭")
   - matchedTitles: 대안의 원본이 되는 야외 활동 제목들 (없으면 빈 배열)
   - confidence: 0.55-0.75
   - ★ 날씨 정보가 없으면 이 유형 절대 금지

4. **목표 상향**: 수치가 증가하는 패턴 (3km→5km, 1주차→2주차) → 다음 단계/목표 제안
   - title: 다음 목표 (예: "달리기 7km")
   - matchedTitles: 진행 이력 제목들
   - confidence: 0.70-0.85
   - 2회 이상이면 충분

5. **반복 패턴**: 같은 제목 ${minOccurrences}회+ 반복 / 고완료율 활동 빈 요일 확장 / 저완료율 활동 가벼운 버전
   - matchedTitles: 매칭된 원본 제목들
   - 반복: 0.65-0.95 (완료율에 비례)
   - 습관 강화: 0.60-0.80
   - 재도전: 0.50-0.65

6. **시즌 추천**: 현재 날짜·계절·한국 문화에 맞는 활동 루틴 제안
   - title: 시즌에 맞는 활동 (예: "벚꽃 산책", "수영장 가기")
   - matchedTitles: 반드시 빈 배열 []
   - daysOfWeek: 주 1-2회 적절한 요일
   - confidence: 0.50-0.65
   - ★ 최대 1개만

## reason 작성 규칙
reason은 "[관찰] + [제안]" 2파트로 구성:
- 관찰: 사용자의 실제 데이터/상황 언급 (완료율, 요일, 시즌 등)
- 제안: 왜 이걸 추천하는지 동기부여 톤으로
- 격려하는 친근한 톤, 딱딱한 보고서 톤 금지

## 규칙
- ★★★ 반드시 정확히 5개를 제안해. 5개 미만은 절대 안 됨. 6가지 유형에서 골고루 뽑아서 반드시 5개를 채워. 데이터가 3개 미만일 때만 빈배열 허용
- ★ 다양한 유형을 골고루 섞어서 제안 (같은 유형 2개 이상 금지, 단 유형5 반복패턴은 2개까지 허용)
- ★ 빠뜨린 루틴이 있으면 반드시 1개 이상 포함
- ★ 시즌 추천은 최대 1개, matchedTitles는 반드시 빈 배열
- ★ 날씨 정보 없으면 유형3 절대 금지
- ★ 반복 패턴은 같은 제목이 ${minOccurrences}회 이상이어야만 인정
- ★ 순차/발전(유형4)은 2회면 충분하지만, 단순 반복(같은 제목)은 절대 2회로 인정 금지
- ★ 1회만 등장한 항목은 절대 패턴 아님
- 요일패턴 분석→daysOfWeek, 시간있으면→scheduledTime(HH:mm)
- title은 제안하는 루틴 이름 (자연스러운 한국어)

## 예시

빠뜨린 루틴:
→ title:"운동", daysOfWeek:["WED"], scheduledTime:"07:00", confidence:0.85, reason:"매주 수요일 운동을 꾸준히 해오셨는데 이번 주 아직 안 하셨어요! 다시 시작해볼까요?", matchedTitles:["운동","운동","운동"]

시간대 루틴:
→ title:"아침 독서 30분", daysOfWeek:["MON","WED","FRI"], scheduledTime:"08:00", confidence:0.70, reason:"오전 완료율이 85%로 높으시네요! 독서도 아침 루틴으로 만들어보면 꾸준히 할 수 있을 거예요.", matchedTitles:["독서 1시간"]

날씨 대비:
→ title:"실내 스트레칭", daysOfWeek:["TUE","THU"], scheduledTime:"18:00", confidence:0.65, reason:"비 오는 날이 많아지고 있어요. 야외 운동 대신 실내 스트레칭 루틴을 만들어두면 좋겠어요!", matchedTitles:["달리기"]

목표 상향:
→ title:"달리기 7km", daysOfWeek:["THU"], scheduledTime:"07:00", confidence:0.80, reason:"3km에서 5km로 꾸준히 늘려오셨어요! 7km에 도전해보는 건 어떨까요?", matchedTitles:["달리기 3km","달리기 5km"]

시즌 추천:
→ title:"벚꽃 산책", daysOfWeek:["SAT"], scheduledTime:null, confidence:0.55, reason:"벚꽃 시즌이에요! 주말에 산책 루틴을 만들어보는 건 어떨까요?", matchedTitles:[]

패턴 없음:
→ [] (단발성 할일만 있으면 반드시 빈배열)

## 할일 기록 (날짜|제목|시간|완료|카테고리)
${todoLines}

JSON 형식으로 응답해.`;
}
