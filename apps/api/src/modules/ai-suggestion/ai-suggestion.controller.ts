import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
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
 * AI가 분석한 패턴 제안을 조회하고 수락/거절하는 API입니다.
 * 프리미엄 유저만 이용 가능합니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회
 * - 제안 수락 (반복 할 일 생성) 또는 거절
 *
 * ### 패턴 유형 (5가지)
 * - **반복**: 동일/유사 제목 3회+ 반복 → 반복 할 일 제안
 * - **순차**: 번호/단계 진행 (1주차→2주차) → 다음 단계 예측 (2회부터 감지)
 * - **발전**: 수치/목표 증가 (3km→5km) → 다음 목표 예측 (2회부터 감지)
 * - **습관 강화**: 완료율 70%+ 활동을 빈 요일에 추가 제안
 * - **재도전**: 완료율 50% 미만 활동을 가벼운 버전으로 제안
 *
 * ### 분석 스케줄
 * - 매일 KST 07:30에 자동 분석
 * - 최근 2주간의 비반복 할 일 패턴을 AI가 분석
 * - 매 분석 시 기존 PENDING 제안을 교체하여 최대 5개 유지 (누적 X)
 * - 14일 후 자동 만료
 *
 * ### 안전성
 * - BullMQ jobId (7일 보관) + PENDING 교체 — 중복 생성/알림 없음
 * - 서버 재시작 시 미처리 잡은 Redis에서 자동 이어서 처리
 */
@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai/suggestions")
export class AiSuggestionController {
	readonly #logger = new Logger(AiSuggestionController.name);

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

## 🧠 AI 패턴 분석 유형

AI는 최근 2주간의 할 일에서 **5가지 패턴**을 감지합니다:

| 유형 | 설명 | 최소 횟수 | confidence 범위 | 예시 |
|------|------|----------|----------------|------|
| **반복** | 같은/유사 제목 반복 | 3회 | 0.7~0.95 | "팀 미팅" × 5 → "팀 미팅" 반복 제안 |
| **순차** | 번호/단계 진행 | 2회 | 0.5~0.9 | "1주차 워크북", "2주차 워크북" → **"3주차 워크북"** 예측 |
| **발전** | 수치/목표 증가 | 2회 | 0.5~0.9 | "달리기 3km", "달리기 5km" → **"달리기 7km"** 예측 |
| **습관 강화** | 완료율 70%+ 활동을 빈 요일에 추가 제안 | 3회 | 0.6~0.8 | 화/목 달리기 100% 완료 → 금요일 추가 제안 |
| **재도전** | 완료율 50% 미만 활동을 가벼운 버전으로 제안 | 3회 | 0.5~0.65 | "독서 1시간" 완료율 25% → "독서 30분" 제안 |

## ⏰ 제안 생성 스케줄 및 조건

**분석 크론**: **매일 KST 07:30**

**생성 조건** (모두 충족해야 제안이 생김):
1. \`subscriptionStatus = ACTIVE\` 또는 \`role = ADMIN\`
2. 최근 2주 내 비반복(\`recurrenceGroupId = null\`) 할 일이 **3개 이상** 존재
3. AI가 위 5가지 패턴 중 하나 이상을 감지

**제안 수량**: 매 분석 시 기존 PENDING 제안을 **교체**하여 최대 **5개** 유지 (누적되지 않음)

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
		this.#logger.debug(`제안 목록 조회: userId=${user.userId}`);

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
		this.#logger.debug(
			`제안 액션: id=${params.id}, userId=${user.userId}, action=${body.action}`,
		);

		const result = await this.aiSuggestionService.handleAction(
			user.userId,
			params.id,
			body,
			tz,
		);

		return result;
	}
}
