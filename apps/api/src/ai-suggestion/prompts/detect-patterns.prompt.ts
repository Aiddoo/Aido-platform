import { dayOfWeekSchema } from "@aido/validators";
import { z } from "zod";
import {
	PROMPT_OUTPUT_DISCIPLINE,
	PROMPT_SECURITY_GUARD,
} from "@/shared/domain/prompt/prompt-sections";
import { sanitizeForPrompt } from "@/shared/domain/prompt/sanitize";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { SuggestionContext, SuggestionHistoryItem } from "../types";
import { buildSuggestionPromptEn } from "./detect-patterns.prompt.en";

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

/** en 로케일용 스키마 — describe만 영어 (구조 동일) */
export const detectedPatternsSchemaEn = z.object({
	patterns: z.array(
		z.object({
			title: z.string().describe("Title of the recurring to-do"),
			daysOfWeek: z
				.array(dayOfWeekSchema)
				.describe("Recurring days (e.g. ['MON', 'WED', 'FRI'])"),
			scheduledTime: z
				.string()
				.nullable()
				.describe("Scheduled time (HH:mm format, null if none)"),
			confidence: z
				.number()
				.min(0)
				.max(1)
				.describe("Pattern confidence (0.0~1.0)"),
			reason: z
				.string()
				.describe("Why this pattern was detected (English, 1-2 sentences)"),
			matchedTitles: z
				.array(z.string())
				.describe(
					"Original to-do titles matching this pattern (empty array for seasonal suggestions)",
				),
		}),
	),
});

export function getDetectedPatternsSchema(locale: SupportedLocale) {
	return locale === "en" ? detectedPatternsSchemaEn : detectedPatternsSchema;
}

export interface SuggestionPrompt {
	system: string;
	prompt: string;
}

export function buildSuggestionPrompt(
	context: SuggestionContext,
	minOccurrences: number,
	locale: SupportedLocale = "ko",
): SuggestionPrompt {
	if (locale === "en") {
		return buildSuggestionPromptEn(context, minOccurrences);
	}
	const todoLines = context.todos
		.map((t) => {
			const time = t.scheduledTime ?? "종일";
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

	const reportSection = context.weeklyReportInsight
		? `\n## 최근 주간 리포트 인사이트\n${context.weeklyReportInsight}\n`
		: "";

	const historySection = buildHistorySection(context.suggestionHistory);

	const system = `너는 사용자의 할 일 데이터를 분석해서 실행 가능한 루틴을 제안하는 코치야.

${PROMPT_SECURITY_GUARD}

## title 작성 규칙 (★가장 중요)
title은 사용자가 "수락" 버튼만 누르면 바로 할 일 목록에 들어가는 제목이야.
- 반드시 구체적인 행동이어야 해. 지금 당장 실행할 수 있는 수준으로.
- "~시간", "~타임", "~구상", "~루틴", "~계획" 같은 추상적 이름 절대 금지.
- 숫자(시간, 횟수, 거리)를 넣으면 더 실행 가능해져.
- 좋은 예: "아침 스트레칭 10분", "영어 단어 30개 암기", "달리기 3km", "플랭크 3세트", "일기 쓰기"
- 나쁜 예: "오후 집중 업무 시간", "개인 학습 시간", "아이디어 구상", "자기계발 루틴", "운동 계획"
- 사용자의 기존 할 일에서 구체적 행동을 참고하되, 단순 복사가 아닌 발전된 제안을 해.

## reason 작성 규칙
- 1~2문장. 친구가 "이거 해봐!" 하고 추천하는 톤.
- 반드시 숫자 근거 1개 이상 포함 (완료율, 횟수, 연속일, 시간대 등).
- 좋은 예: "매주 수요일 운동을 3주 연속 하셨어요! 이번 주도 이어가볼까요?"
- 나쁜 예: "운동 관련 활동을 꾸준히 하고 계시네요. 운동을 루틴으로 만들어보세요."

## 제안 유형 (8가지 중 최대 5개 선택, 다양하게 섞어서)

1. **빠뜨린 루틴 리마인드**: "빠뜨린 루틴" 섹션의 항목을 반복 루틴으로 제안
   - matchedTitles: 해당 활동의 원본 제목들
   - confidence: 0.75-0.90

2. **시간대 루틴**: 완료율 높은 시간대에 새 루틴 제안
   - title 예: "아침 독서 30분", "오후 영어 듣기 20분"
   - scheduledTime: 완료율 높은 시간대 (오전 08:00~11:00, 오후 14:00~17:00)
   - matchedTitles: 참고한 기존 할 일 제목들
   - confidence: 0.60-0.80

3. **날씨 대비 루틴**: 비/눈 예보 시 실내 대안 제안
   - title 예: "실내 스트레칭 15분", "홈트레이닝 20분"
   - matchedTitles: 대안의 원본이 되는 야외 활동 제목들 (없으면 빈 배열)
   - confidence: 0.55-0.75
   - ★ 날씨 정보가 없으면 이 유형 절대 금지

4. **목표 상향**: 수치가 증가하는 패턴 → 다음 단계 제안
   - title 예: "달리기 7km", "플랭크 4세트"
   - matchedTitles: 진행 이력 제목들
   - confidence: 0.70-0.85
   - 2회 이상이면 충분

5. **반복 패턴**: 같은 제목 ${minOccurrences}회+ 반복 / 고완료율 활동 빈 요일 확장 / 저완료율 활동 가벼운 버전
   - matchedTitles: 매칭된 원본 제목들
   - 반복: 0.65-0.95 (완료율에 비례)
   - 습관 강화: 0.60-0.80
   - 재도전: 0.50-0.65
   - ★ 2회 반복일 때는 confidence를 반드시 0.75 이상으로, 3회+ 반복은 0.60 이상으로 매겨.

6. **시즌 추천**: 현재 계절·한국 문화에 맞는 구체적 활동
   - title 예: "벚꽃길 산책 30분", "수영장 자유형 30분", "단풍길 하이킹"
   - matchedTitles: 반드시 빈 배열 []
   - daysOfWeek: 주 1-2회
   - confidence: 0.50-0.65
   - ★ 최대 1개만

7. **습관 회복**: 3주+ 꾸준히 하다가 최근 빠진 활동 재시작 제안
   - title 예: "수요일 저녁 운동 1시간"
   - reason에 "N주 연속 하시다가 이번 주 빠졌어요" 패턴
   - matchedTitles: 해당 활동 이력
   - confidence: 0.70-0.85

8. **밸런스 제안**: 한 카테고리 60%+ 시, 소외된 카테고리에서 구체적 활동 추천
   - title 예: "주말 요가 30분", "저녁 산책 20분"
   - matchedTitles: 빈 배열 []
   - confidence: 0.55-0.70
   - ★ 최대 1개만

${PROMPT_OUTPUT_DISCIPLINE}

## 규칙
- ★★★ 반드시 정확히 5개를 제안해. 8가지 유형에서 골고루 뽑아서 반드시 5개를 채워. 데이터가 3개 미만일 때만 빈배열 허용
- ★ 다양한 유형을 골고루 섞어서 제안 (같은 유형 2개 이상 금지, 단 유형5 반복패턴은 2개까지 허용)
- ★ 빠뜨린 루틴이 있으면 반드시 1개 이상 포함
- ★ 날씨 정보 없으면 유형3 절대 금지
- ★ 시즌 추천은 최대 1개, matchedTitles는 반드시 빈 배열
- ★ 밸런스 제안은 최대 1개, matchedTitles는 반드시 빈 배열
- ★ 사용자 거절 이력과 유사한 제안은 피하기
- ★ 반복 패턴은 같은 제목이 ${minOccurrences}회 이상이어야 인정 (2회일 때는 confidence 0.75+ 필수)
- ★ 순차/발전(유형4)은 2회면 충분
- ★ 1회만 등장한 항목은 절대 패턴 아님
- ★ reason에는 반드시 숫자 근거 1개 이상 포함 (예: "4주 연속", "완료율 85%", "3회 연속")
- 요일패턴 분석→daysOfWeek, 시간있으면→scheduledTime(HH:mm)

## 예시

빠뜨린 루틴:
→ title:"운동", daysOfWeek:["WED"], scheduledTime:"07:00", confidence:0.85, reason:"매주 수요일 운동을 3주 연속 하셨는데 이번 주 아직 없어요! 다시 시작해볼까요?", matchedTitles:["운동","운동","운동"]

시간대 루틴:
→ title:"아침 독서 30분", daysOfWeek:["MON","WED","FRI"], scheduledTime:"08:00", confidence:0.70, reason:"오전 완료율이 85%로 높으시네요! 독서도 아침에 넣으면 꾸준히 할 수 있을 거예요.", matchedTitles:["독서 1시간"]

목표 상향:
→ title:"달리기 7km", daysOfWeek:["THU"], scheduledTime:"07:00", confidence:0.80, reason:"3km에서 5km로 꾸준히 늘려오셨어요! 다음은 7km 어떨까요?", matchedTitles:["달리기 3km","달리기 5km"]

습관 회복:
→ title:"저녁 스트레칭 15분", daysOfWeek:["MON","WED","FRI"], scheduledTime:"22:00", confidence:0.75, reason:"4주 연속 스트레칭을 하시다가 이번 주 빠졌어요! 가볍게 15분만 다시 시작해봐요.", matchedTitles:["스트레칭","스트레칭","스트레칭"]

밸런스 제안:
→ title:"주말 요가 30분", daysOfWeek:["SAT"], scheduledTime:"10:00", confidence:0.60, reason:"업무 할 일이 72%를 차지하고 있어요. 주말에 요가로 리프레시 어때요?", matchedTitles:[]

시즌 추천:
→ title:"벚꽃길 산책 30분", daysOfWeek:["SAT"], scheduledTime:null, confidence:0.55, reason:"벚꽃 시즌이에요! 주말에 가까운 공원에서 30분 산책 어떨까요?", matchedTitles:[]

패턴 없음 (데이터 부족):
→ [] (단발성 할일만 있으면 반드시 빈배열)`;

	const prompt = `아래 사용자 데이터를 분석해서 맞춤 루틴을 제안해줘.

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
${weatherSection}${reportSection}${historySection}
## 할일 기록 (날짜|제목|시간|완료|카테고리)
${todoLines}

JSON 형식으로 응답해.`;

	return { system, prompt };
}

function buildHistorySection(history: SuggestionHistoryItem[]): string {
	if (history.length === 0) {
		return "";
	}

	const accepted = history
		.filter((h) => h.status === "ACCEPTED")
		.map((h) => h.title);
	const dismissed = history
		.filter((h) => h.status === "DISMISSED")
		.map((h) => h.title);

	const lines: string[] = ["\n## 사용자 제안 선호 이력"];
	if (accepted.length > 0) {
		lines.push(`수락: ${accepted.join(", ")}`);
	}
	if (dismissed.length > 0) {
		lines.push(`거절: ${dismissed.join(", ")}`);
	}
	lines.push(
		"→ 거절한 것과 유사한 제안은 피하고, 수락 패턴에 맞는 제안을 우선해줘.\n",
	);
	return lines.join("\n");
}
