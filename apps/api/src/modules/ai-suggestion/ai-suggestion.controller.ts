import { ErrorCode } from "@aido/errors";
import { Body, Controller, Get, Logger, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Timezone } from "@/common/decorators/timezone.decorator";

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
 * AI 반복 제안 API 컨트롤러
 *
 * AI가 분석한 반복 패턴 제안을 조회하고 수락/거절하는 API입니다.
 * 프리미엄 유저만 이용 가능합니다.
 *
 * ### 주요 기능
 * - 대기 중인 제안 목록 조회
 * - 제안 수락 (반복 할 일 생성) 또는 거절
 *
 * ### 분석 스케줄
 * - 매주 토요일 UTC 13:00 (KST 일요일 22:00)에 자동 분석
 * - 최근 4주간의 비반복 할 일 패턴을 AI가 분석
 * - 매 분석 시 기존 PENDING 제안을 교체하여 최대 5개 유지 (누적 X)
 * - 14일 후 자동 만료
 *
 * ### 안전성
 * - 분산 락 + BullMQ jobId (7일 보관) + PENDING 교체 — 중복 생성/알림 없음
 * - 서버 재시작 시 미처리 잡은 Redis에서 자동 이어서 처리
 * - 서버 재시작 시 onModuleInit catch-up (이미 처리된 주는 jobId로 자동 스킵)
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
		summary: "AI 반복 제안 목록 조회",
		operationId: "getAiSuggestions",
		description: `대기 중인(PENDING) AI 반복 제안 목록을 조회합니다.
만료되지 않은 PENDING 상태의 제안만 반환됩니다.

## 📊 제안 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | number | 제안 ID |
| \`title\` | string | 제안된 반복 할 일 제목 |
| \`daysOfWeek\` | string[] | 반복 요일 (\`MON\`~\`SUN\`) |
| \`scheduledTime\` | string \\| null | 추천 시간 (HH:mm, null이면 종일) |
| \`confidence\` | number | AI 확신도 (0.0~1.0) |
| \`reason\` | string | 제안 이유 (한국어) |
| \`status\` | string | 항상 \`"PENDING"\` (이 API는 PENDING만 반환) |
| \`expiresAt\` | string | 만료 시각 (ISO 8601, 생성 후 14일) |
| \`createdAt\` | string | 제안 생성 시각 (ISO 8601) |

## ⏰ 제안 생성 스케줄 및 조건

**분석 크론**: 매주 토요일 UTC 13:00 (KST **일요일 22:00**)

**생성 조건** (모두 충족해야 제안이 생김):
1. \`subscriptionStatus = ACTIVE\` 또는 \`role = ADMIN\`
2. 최근 4주 내 비반복(\`recurrenceGroupId = null\`) 할 일이 존재
3. AI가 동일 패턴을 **3회 이상** 감지

**제안 수량**: 매 분석 시 기존 PENDING 제안을 **교체**하여 최대 **5개** 유지 (누적되지 않음)

**만료**: 생성 후 **14일** 경과 시 자동 만료 (목록에서 사라짐)

## 🔍 구체적 예시

### 타임라인
\`\`\`
2026-03-04 (수) 06:24 KST  → 프리미엄 가입 (또는 ADMIN 전환)
2026-03-08 (일) 22:00 KST  → 첫 분석 크론 실행 (토 13:00 UTC)
                             → 조건 충족 시, 이 직후부터 GET /ai/suggestions에 표시
2026-03-22 (일) 13:00 UTC   → 위 제안들 만료 (14일 경과)
\`\`\`

### 예시 데이터 (최근 4주 비반복 할 일)
- **팀 미팅** 10:00 → 02-23, 02-25, 02-27, 03-02, 03-04 (5회, 월/수/금 패턴)
- **헬스장 가기** 19:30 → 02-17, 02-19, 02-24, 02-26 (4회, 화/목 패턴)
- **영어공부** → 03-01, 03-03 (2회뿐 → **최소 3회 미달, 제안 안 됨**)

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
      "reason": "최근 4주간 유사한 제목이 월/수/금 오전에 반복되었습니다.",
      "status": "PENDING",
      "expiresAt": "2026-03-22T13:00:00.000Z",
      "createdAt": "2026-03-08T13:00:00.000Z"
    },
    {
      "id": 102,
      "title": "헬스장 가기",
      "daysOfWeek": ["TUE", "THU"],
      "scheduledTime": "19:30",
      "confidence": 0.81,
      "reason": "최근 4주간 화/목 저녁 시간대에 반복 수행 패턴이 있습니다.",
      "status": "PENDING",
      "expiresAt": "2026-03-22T13:00:00.000Z",
      "createdAt": "2026-03-08T13:00:00.000Z"
    }
  ]
}
\`\`\`
> "영어공부"는 2회뿐이라 최소 3회 조건 미달 → 제안 생성 안 됨

## 🔒 안전성 보장

### 중복 방지 (3중 방어)
| 계층 | 메커니즘 | 효과 |
|------|---------|------|
| **1. 분산 락** | Redis \`SET NX PX\` (23h TTL) | 다중 인스턴스 동시 크론 실행 방지 |
| **2. BullMQ jobId** | \`suggestion:{userId}:{year}-W{xx}\` (7일 보관) | 같은 주 동일 유저 중복 잡 방지 |
| **3. PENDING 교체** | 분석 전 기존 PENDING 전부 삭제 후 새로 생성 | 누적 없이 항상 최대 5개 유지 |

### 서버 재시작 시 동작
- 이미 큐에 들어간 잡: Redis에서 자동 이어서 처리 (유실 없음)
- 크론 누락 catch-up: 서버 시작 시 \`onModuleInit\`이 자동으로 dispatch 재시도
- 이미 처리된 주: 완료된 잡이 7일간 Redis에 보관되어 jobId 중복으로 자동 스킵 (불필요한 API 호출 없음)
- 알림 중복: jobId 기반 dedup + PENDING 교체로 중복 불가

## 📱 클라이언트 통합 가이드

### 프리미엄 가입 직후
프리미엄 가입 즉시 제안이 보이지 **않습니다**.
가장 빠른 첫 생성 시점은 **가입 후 돌아오는 첫 번째 토요일 UTC 13:00** (KST 일요일 22:00)입니다.
이 시점에 크론이 실행되더라도 위 조건을 충족하지 못하면 빈 배열이 반환됩니다.

### 폴링 전략
- 주 1회만 갱신되므로, **앱 시작 시 1회 호출**이면 충분합니다.
- 일요일 22:00 KST 이후 호출하면 새 제안을 확인할 수 있습니다.
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
	@ApiDoc({
		summary: "AI 반복 제안 수락/거절",
		operationId: "handleAiSuggestion",
		description: `AI 반복 제안을 수락하거나 거절합니다.

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
