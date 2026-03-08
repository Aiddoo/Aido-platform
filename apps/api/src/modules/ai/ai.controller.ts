import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Timezone } from "@/common/decorators";
import {
	ApiBadRequestError,
	ApiDoc,
	ApiServiceUnavailableError,
	ApiSuccessResponse,
	ApiTooManyRequestsError,
	ApiUnauthorizedError,
	ApiUnprocessableError,
	SWAGGER_TAGS,
} from "@/common/swagger";
import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";

import { AiService } from "./ai.service";
import {
	AiUsageResponseDto,
	ParseTodoRequestDto,
	ParseTodoResponseDto,
} from "./dtos";
import { AiUsageGuard } from "./guards/ai-usage.guard";

@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai")
export class AiController {
	readonly #logger = new Logger(AiController.name);

	constructor(private readonly aiService: AiService) {}

	/**
	 * @example
	 * ```
	 * // Request
	 * POST /ai/parse-todo
	 * { "text": "내일 오후 3시에 팀 미팅" }
	 *
	 * // Response
	 * {
	 *   "success": true,
	 *   "data": {
	 *     "title": "팀 미팅",
	 *     "startDate": "2025-01-26",
	 *     "scheduledTime": "15:00",
	 *     "isAllDay": false,
	 *     "isRecurring": false,
	 *     "recurrence": null
	 *   },
	 *   "meta": {
	 *     "model": "google:gemini-2.5-flash-lite",
	 *     "processingTimeMs": 185,
	 *     "tokenUsage": { "input": 180, "output": 45 }
	 *   }
	 * }
	 * ```
	 */
	@Post("parse-todo")
	@HttpCode(HttpStatus.OK)
	@UseGuards(AiUsageGuard)
	@ApiHeader({
		name: "X-Timezone",
		required: false,
		description: "사용자 타임존 (IANA, 기본값: UTC)",
		example: "Asia/Seoul",
	})
	@ApiDoc({
		summary: "자연어 텍스트를 투두 데이터로 파싱",
		operationId: "parseNaturalLanguageTodo",
		description: `한국어 자연어 입력을 분석하여 구조화된 투두 데이터를 생성합니다.

## 📝 입력 필드
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| \`text\` | string | 1-500자 | 파싱할 자연어 텍스트 |

## 🎯 출력 데이터 (\`data\`)
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`title\` | string | ✅ | 추출된 할 일 제목 |
| \`startDate\` | string | ✅ | 시작 날짜 (YYYY-MM-DD) |
| \`endDate\` | string \\| null | ❌ | 종료 날짜 (기간 일정용, 단일 날짜는 null) |
| \`scheduledTime\` | string \\| null | ❌ | 예정 시간 (HH:mm, 24시간, 종일 일정은 null) |
| \`isAllDay\` | boolean | ✅ | 종일 여부 |
| \`isRecurring\` | boolean | ✅ | 반복 일정 여부 |
| \`recurrence\` | object \\| null | ❌ | 반복 설정 (비반복 일정은 null) |
| \`recurrence.daysOfWeek\` | string[] | - | 반복 요일 (\`MON\`~\`SUN\`) |
| \`recurrence.endDate\` | string | - | 반복 종료일 (YYYY-MM-DD) |

## 📊 메타데이터 (\`meta\`)
| 필드 | 타입 | 설명 |
|------|------|------|
| \`model\` | string | 사용된 AI 모델명 |
| \`processingTimeMs\` | number | 처리 시간 (ms) |
| \`tokenUsage.input\` | number | 입력 토큰 수 |
| \`tokenUsage.output\` | number | 출력 토큰 수 |

## ⏰ 스마트 시간 해석 규칙

### 1. 명시적 시간대
- "오전", "아침" → AM (00:00-11:59)
- "오후", "저녁", "밤" → PM (12:00-23:59)

### 2. 시간만 언급된 경우
- 현재 시간 기준 가장 가까운 미래 시간으로 해석
- 예: 현재 14:30에 "11시" → 23:00 (오전 11시는 지남)

### 3. 상대적 날짜
- "내일" → 다음 날
- "모레" → 이틀 후
- "다음주 월요일" → 다음 주 월요일
- "이번주 금요일" → 이번 주 금요일

### 4. 기간 일정
- "월요일부터 금요일까지" → startDate + endDate 모두 설정

## 🚫 사용량 제한
- 무료 유저: **일일 5회**
- 프리미엄: 무제한 (향후)
- 리셋 시간: KST 자정

## 💡 입력 예시
| 입력 | 예상 출력 |
|------|----------|
| \`내일 오후 3시에 팀 미팅\` | title: "팀 미팅", startDate: 내일, scheduledTime: "15:00" |
| \`11시에 공부하기\` | title: "공부하기", scheduledTime: 현재시간 기반 AM/PM |
| \`다음주 월요일부터 금요일까지 출장\` | title: "출장", startDate~endDate |
| \`저녁에 운동\` | title: "운동", scheduledTime: "19:00" |

## 📱 클라이언트 통합 가이드

### 권장 플로우
\`\`\`
1. POST /ai/parse-todo  → 자연어 파싱
2. 사용자에게 결과 표시  → 확인/수정 기회 제공
3. POST /todos          → 최종 Todo 생성
\`\`\`

### 예시 코드 (React Native)
\`\`\`typescript
// 1단계: AI 파싱
const parseResult = await api.post('/ai/parse-todo', {
  text: '내일 오후 3시 회의'
});

// 2단계: 사용자 확인 UI 표시
const confirmed = await showConfirmDialog(parseResult.data);

// 3단계: 확인 후 Todo 생성
if (confirmed) {
  await api.post('/todos', parseResult.data);
}
\`\`\`

### 이 패턴을 사용하는 이유
- **사용자 확인 단계**: AI 파싱 결과를 사용자가 검토/수정 가능
- **유연성**: 파싱만 사용하거나, 수동 생성도 가능
- **오류 복구**: 파싱 실패 시 사용자가 직접 수정 가능`,
	})
	@ApiSuccessResponse({ type: ParseTodoResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiUnprocessableError(ErrorCode.AI_1302)
	@ApiTooManyRequestsError(ErrorCode.AI_1303)
	@ApiServiceUnavailableError(ErrorCode.AI_1301)
	async parseTodo(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: ParseTodoRequestDto,
		@Timezone() tz: string,
	): Promise<ParseTodoResponseDto> {
		this.#logger.debug(
			`AI 파싱 요청: user=${user.userId}, tz=${tz}, text="${dto.text}"`,
		);

		const result = await this.aiService.parseTodo(
			dto.text,
			user.userId,
			tz,
			dto.categoryId,
		);

		this.#logger.log(
			`AI 파싱 완료: user=${user.userId}, title="${result.data.title}", ` +
				`model=${result.meta.model}, time=${result.meta.processingTimeMs}ms`,
		);

		return {
			success: true,
			data: result.data,
			meta: result.meta,
		};
	}

	/**
	 * @example
	 * ```
	 * // Request
	 * GET /ai/usage
	 *
	 * // Response (무료 유저)
	 * {
	 *   "success": true,
	 *   "data": {
	 *     "used": 3,
	 *     "limit": 5,
	 *     "resetsAt": "2026-03-05T15:00:00.000Z"
	 *   }
	 * }
	 *
	 * // Response (프리미엄 유저)
	 * {
	 *   "success": true,
	 *   "data": {
	 *     "used": 12,
	 *     "limit": null,
	 *     "resetsAt": "2026-03-05T15:00:00.000Z"
	 *   }
	 * }
	 * ```
	 */
	@Get("usage")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "AI 사용량 조회",
		operationId: "getAiUsage",
		description: `현재 사용자의 일일 AI 사용량을 조회합니다.

## 📊 응답 데이터
| 필드 | 타입 | 설명 |
|------|------|------|
| \`used\` | number | 오늘 사용한 횟수 |
| \`limit\` | number \\| null | 일일 제한 횟수 (null = 무제한, 프리미엄) |
| \`resetsAt\` | string | 다음 리셋 시간 (ISO 8601, UTC) |

## ⏰ 리셋 규칙
- 리셋 시간: KST 자정 (UTC 15:00)
- 리셋 후 \`used\`는 0으로 초기화됩니다.

## 💡 사용 예시
\`\`\`typescript
const usage = await fetch('/ai/usage');
const { used, limit, resetsAt } = usage.data;

if (limit !== null && used >= limit) {
  const resetTime = new Date(resetsAt);
  console.log(\`사용 제한 도달. \${resetTime.toLocaleString()}에 리셋됩니다.\`);
}
\`\`\``,
	})
	@ApiSuccessResponse({ type: AiUsageResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async getUsage(
		@CurrentUser() user: CurrentUserPayload,
	): Promise<AiUsageResponseDto> {
		const usage = await this.aiService.getUsage(user.userId);

		return {
			success: true,
			data: usage,
		};
	}
}
