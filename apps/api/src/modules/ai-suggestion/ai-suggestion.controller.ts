import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Timezone } from "@/common/decorators";

import {
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";
import { AiSuggestionService } from "./ai-suggestion.service";
import {
	SuggestionActionDto,
	SuggestionActionResponseDto,
	SuggestionIdParamDto,
	SuggestionListResponseDto,
} from "./dtos";

/**
 * AI 제안 API 컨트롤러
 *
 * 사용자 행동 데이터와 외부 컨텍스트(날씨, 시즌)를 기반으로
 * 맞춤 루틴을 제안하고 수락/거절하는 API입니다.
 * 프리미엄 유저만 이용 가능합니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회
 * - 제안 수락 (반복 할 일 생성) 또는 거절
 *
 * ### 제안 유형 (8가지 중 최대 5개)
 * - **빠뜨린 루틴**: 정기적으로 하던 활동이 이번 주에 빠진 경우 리마인드
 * - **시간대 루틴**: 완료율이 높은 시간대에 새 루틴 제안
 * - **날씨 대비 루틴**: 비/눈 예보 시 실내 대안 루틴 제안
 * - **목표 상향**: 수치가 증가하는 패턴 감지 → 다음 목표 제안
 * - **반복 패턴**: 동일 제목 반복/습관 강화/재도전 제안
 * - **시즌 추천**: 현재 계절·한국 문화에 맞는 활동 루틴 제안
 * - **습관 회복**: 3주+ 꾸준히 하다가 최근 빠진 장기 습관 재시작 제안
 * - **밸런스 제안**: 한 카테고리가 60%+ 점유 시 소외된 카테고리 활동 추천
 *
 * ### 분석 방식
 * - 서버에서 완료율/시간 패턴/카테고리 통계를 사전 계산
 * - 최근 주간 보고서 인사이트(달성률, 약한 카테고리 등)를 크로스 주입
 * - 최근 30일 제안 수락/거절 이력을 학습하여 거절 패턴 회피
 * - AI는 계산된 인사이트 + 보고서 데이터 + 이력 + 원시 투두를 기반으로 제안 생성
 *
 * ### 분석 스케줄
 * - 매일 KST 07:30에 자동 분석
 * - 투두 기록 2주 + 통계 컨텍스트 4주 범위로 분석
 * - 매 분석 시 기존 PENDING 제안을 교체하여 최대 5개 유지 (누적 X)
 * - 14일 후 자동 만료
 *
 * ### 안전성
 * - BullMQ jobId (7일 보관) + PENDING 교체 — 중복 생성/알림 없음
 * - 서버 재시작 시 미처리 잡은 Redis에서 자동 이어서 처리
 * - 날씨 조회 실패 시 graceful degradation (날씨 제안만 제외)
 */
@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai/suggestions")
export class AiSuggestionController {
	constructor(private readonly aiSuggestionService: AiSuggestionService) {}

	/**
	 * GET /ai/suggestions - 대기 중인 제안 목록 조회
	 */
	@Get()
	@ApiDoc({
		summary: "AI 제안 목록 조회",
		operationId: "getAiSuggestions",
		description: `대기 중인(PENDING) AI 제안 목록을 조회합니다.
만료되지 않은 PENDING 상태의 제안만 반환됩니다.

## 📊 제안 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | number | 제안 ID |
| \`title\` | string | 예측된 다음 할 일 제목 |
| \`daysOfWeek\` | string[] | 반복 요일 (\`MON\`~\`SUN\`) |
| \`scheduledTime\` | string \\| null | 추천 시간 (HH:mm, null이면 종일) |
| \`confidence\` | number | AI 확신도 (0.0~1.0) |
| \`reason\` | string | 제안 이유 (한국어) |
| \`status\` | string | 항상 \`"PENDING"\` (이 API는 PENDING만 반환) |
| \`expiresAt\` | string | 만료 시각 (ISO 8601, 생성 후 14일) |
| \`createdAt\` | string | 제안 생성 시각 (ISO 8601) |
| \`suggestedCategoryId\` | number \\| null | 추천 카테고리 ID (매칭된 투두의 최빈 카테고리, 없으면 null) |

## 🧠 AI 제안 유형 (8가지 중 최대 5개)

서버에서 사전 계산한 통계 + 날씨 + 시즌 + 보고서 인사이트 + 이력 학습을 기반으로 **8가지 유형**의 맞춤 루틴을 제안합니다:

| 유형 | 트리거 | confidence 범위 | 예시 |
|------|--------|----------------|------|
| **빠뜨린 루틴** | 정기 활동이 이번 주에 빠짐 | 0.75~0.90 | "매주 수요일 운동했는데 이번 주 빠졌네요" |
| **시간대 루틴** | 오전/오후 완료율 격차 큼 | 0.60~0.80 | "오전 완료율이 높으니 아침 독서 루틴 어때요?" |
| **날씨 대비** | 비/눈 예보 (위치 설정 필요) | 0.55~0.75 | "비 오는 날 대비 실내 운동 루틴 어때요?" |
| **목표 상향** | 수치 진행 패턴 (2회+) | 0.70~0.85 | "3km→5km 도전해볼까요?" |
| **반복 패턴** | 같은 제목 2회+ (2회는 conf 0.75+ / 3회+는 0.6+) / 습관 강화 / 재도전 | 0.50~0.95 | "팀 미팅" 반복 제안, "독서 30분" 가벼운 버전 |
| **시즌 추천** | 현재 계절·한국 문화 | 0.50~0.65 | "벚꽃 시즌이니 산책 루틴 어때요?" |
| **습관 회복** | 3주+ 꾸준하다가 최근 빠진 습관 | 0.70~0.85 | "4주 연속 하시다가 이번 주 빠졌어요" |
| **밸런스 제안** | 카테고리 60%+ 편중 | 0.55~0.70 | "업무 비중이 높아요, 자기계발도 추가해볼까요?" |

## 🔗 크로스 데이터 활용

| 데이터 소스 | 활용 방식 |
|------------|----------|
| **주간 보고서 인사이트** | 약한 카테고리, 달성률, 스트릭 정보를 제안에 반영 |
| **수락/거절 이력** | 최근 30일 이력을 학습하여 거절 패턴 회피, 수락 패턴 강화 |

## ⏰ 제안 생성 스케줄 및 조건

**분석 크론**: **매일 KST 07:30**

**생성 조건** (모두 충족해야 제안이 생김):
1. \`subscriptionStatus = ACTIVE\` 또는 \`role = ADMIN\`
2. 최근 2주 내 비반복(\`recurrenceGroupId = null\`) 할 일이 **3개 이상** 존재
3. AI가 위 8가지 유형 중 하나 이상을 감지

**제안 수량**: 매 분석 시 기존 PENDING 제안을 **교체**하여 최대 **5개** 유지 (누적되지 않음). 1차 결과가 3개 미만이면 다양성 재시도를 자동 수행하고, matchedTitles가 빈 시즌/밸런스 유형은 최대 2개로 캡을 두어 제안이 균형 있게 섞이도록 한다.

**만료**: 생성 후 **14일** 경과 시 자동 만료 (목록에서 사라짐)

## 🔍 구체적 예시

### 타임라인
\`\`\`
2026-03-04 (수) 06:24 KST  → 프리미엄 가입 (또는 ADMIN 전환)
2026-03-04 (수) 11:00 KST  → 당일 분석 크론 실행
                             → 조건 충족 시, 이 직후부터 GET /ai/suggestions에 표시
2026-03-18 (수) 11:00 KST   → 위 제안들 만료 (14일 경과)
\`\`\`

### 예시 데이터 (최근 2주 비반복 할 일)
- **팀 미팅** 10:00 → 02-23, 02-25, 02-27, 03-02, 03-04 (5회, 월/수/금 패턴) → **반복 패턴**
- **1주차 워크북**, **2주차 워크북**, **3주차 워크북** → 매주 월요일 → **순차 패턴 (4주차 예측)**
- **달리기 3km** 07:00, **달리기 5km** 07:00 → 매주 수요일 → **발전 패턴 (7km 예측)**

### 예시 응답
\`\`\`json
{
  "suggestions": [
    {
      "id": 101,
      "title": "팀 미팅",
      "daysOfWeek": ["MON", "WED", "FRI"],
      "scheduledTime": "10:00",
      "confidence": 0.88,
      "reason": "최근 2주간 유사한 제목이 월/수/금 오전에 반복되었습니다.",
      "status": "PENDING",
      "expiresAt": "2026-03-18T02:00:00.000Z",
      "createdAt": "2026-03-04T02:00:00.000Z",
      "suggestedCategoryId": 3
    },
    {
      "id": 102,
      "title": "4주차 워크북",
      "daysOfWeek": ["MON"],
      "scheduledTime": null,
      "confidence": 0.85,
      "reason": "매주 월요일 워크북이 순차 진행중 (1→2→3주차)",
      "status": "PENDING",
      "expiresAt": "2026-03-18T02:00:00.000Z",
      "createdAt": "2026-03-04T02:00:00.000Z",
      "suggestedCategoryId": 2
    },
    {
      "id": 103,
      "title": "달리기 7km",
      "daysOfWeek": ["WED"],
      "scheduledTime": "07:00",
      "confidence": 0.6,
      "reason": "수요일 아침 달리기 거리가 2km씩 증가하는 발전 패턴",
      "status": "PENDING",
      "expiresAt": "2026-03-18T02:00:00.000Z",
      "createdAt": "2026-03-04T02:00:00.000Z",
      "suggestedCategoryId": 5
    }
  ]
}
\`\`\`

## 🔒 안전성 보장

### 중복 방지 (2중 방어)
| 계층 | 메커니즘 | 효과 |
|------|---------|------|
| **1. BullMQ jobId** | \`suggestion_{userId}_{YYYY-MM-DD}\` (7일 보관) | 같은 날 동일 유저 중복 잡 방지 |
| **2. PENDING 교체** | 분석 전 기존 PENDING 전부 삭제 후 새로 생성 | 누적 없이 항상 최대 5개 유지 |

### 서버 재시작 시 동작
- 이미 큐에 들어간 잡: Redis에서 자동 이어서 처리 (유실 없음)
- 이미 처리된 날: 완료된 잡이 7일간 Redis에 보관되어 jobId 중복으로 자동 스킵 (불필요한 API 호출 없음)
- 알림 중복: jobId 기반 dedup + PENDING 교체로 중복 불가

## 📱 클라이언트 통합 가이드

### 프리미엄 가입 직후
프리미엄 가입 즉시 제안이 보이지 **않습니다**.
가장 빠른 첫 생성 시점은 **당일 KST 07:30** (이미 지났다면 다음 날)입니다.
이 시점에 크론이 실행되더라도 위 조건을 충족하지 못하면 빈 배열이 반환됩니다.

### 폴링 전략
- 매일 갱신되므로, **앱 시작 시 1회 호출**이면 충분합니다.
- KST 07:30 이후 호출하면 새 제안을 확인할 수 있습니다.
- 빈 배열이라면 "아직 분석할 데이터가 부족합니다" 등의 안내를 표시하세요.`,
	})
	@ApiSuccessResponse({ type: SuggestionListResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1309)
	async getPendingSuggestions(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<SuggestionListResponseDto> {
		const suggestions = await this.aiSuggestionService.getPendingSuggestions(
			user.userId,
		);

		return { suggestions };
	}

	/**
	 * PATCH /ai/suggestions/:id - 제안 수락 또는 거절
	 */
	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "AI 제안 수락/거절",
		operationId: "handleAiSuggestion",
		description: `AI 제안을 수락하거나 거절합니다.

## 📝 요청 본문
| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|-------|------|
| \`action\` | string | ✅ | - | \`"accept"\` 또는 \`"dismiss"\` |
| \`categoryId\` | number | ❌ | - | 수락 시 할 일을 추가할 카테고리 ID |
| \`startDate\` | string | ❌ | 오늘 | 반복 시작일 (YYYY-MM-DD) |
| \`endDate\` | string | ❌ | 4주 후 | 반복 종료일 (YYYY-MM-DD) |

## ✅ accept 시 동작
1. 지정된 카테고리에 반복 할 일이 자동 생성됩니다.
2. 응답의 \`createdTodosCount\`에 생성된 할 일 개수가 반환됩니다.
3. 제안 상태가 \`ACCEPTED\`로 변경됩니다.

## ❌ dismiss 시 동작
- 제안 상태가 \`DISMISSED\`로 변경되고, 더 이상 목록에 나타나지 않습니다.`,
	})
	@ApiSuccessResponse({ type: SuggestionActionResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.AI_1309)
	@ApiNotFoundError(ErrorCode.AI_1305)
	async handleSuggestion(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: SuggestionIdParamDto,
		@Body() body: SuggestionActionDto,
		@Timezone() tz: string,
	): Promise<SuggestionActionResponseDto> {
		const result = await this.aiSuggestionService.handleAction(
			user.userId,
			params.id,
			body,
			tz,
		);

		return result;
	}
}
