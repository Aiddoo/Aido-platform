import { ErrorCode } from "@aido/api/errors";
import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { Locale, Timezone } from "#api/platform/http/decorators/index";
import {
  ApiDoc,
  ApiErrorCodesResponse,
  ApiServiceUnavailableError,
  ApiForbiddenError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  ApiUnprocessableError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { GetAiUsage } from "../../../application/use-cases/parsing/get-ai-usage.use-case.js";
import { ParseMemo } from "../../../application/use-cases/parsing/parse-memo.use-case.js";
import { ParseTodo } from "../../../application/use-cases/parsing/parse-todo.use-case.js";
import { AiDataSharingConsentGuard } from "../../../infrastructure/guards/parsing/ai-data-sharing-consent.guard.js";
import { AiUsageGuard } from "../../../infrastructure/guards/parsing/ai-usage.guard.js";
import {
  AiUsageResponseDto,
  ParseMemoRequestDto,
  ParseMemoResponseDto,
  ParseTodoRequestDto,
  ParseTodoResponseDto,
} from "../../schemas/parsing/index.js";

@ApiTags(SWAGGER_TAGS.AI)
@ApiBearerAuth()
@Controller("ai")
export class AiController {
  constructor(
    private readonly parseTodoUseCase: ParseTodo,
    private readonly parseMemoUseCase: ParseMemo,
    private readonly getAiUsageUseCase: GetAiUsage,
  ) {}

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
   *     "model": "google:gemini-3.1-flash-lite",
   *     "processingTimeMs": 185,
   *     "tokenUsage": { "input": 180, "output": 45 }
   *   }
   * }
   * ```
   */
  @Post("parse-todo")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiDataSharingConsentGuard, AiUsageGuard)
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 1.13.0 이상이면 AI 데이터 처리 동의가 있어야 처리합니다.",
  })
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 미전송 시 저장된 사용자 타임존을 사용합니다.",
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
| \`categoryId\` | number | 선택 | 카테고리 ID (선택한 카테고리를 응답에 pass-through) |

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
| \`promptVersion\` | string (선택) | 응답을 만든 프롬프트 버전 (예: \`parse-todo@v2\`). 구 서버 응답에는 없을 수 있습니다. |

## ⏰ 날짜·시간 해석 규칙
AI는 문장에서 날짜·시각 표현의 종류만 읽고, 실제 날짜·요일·시각은 서버가 사용자 시간대(\`X-Timezone\`, 없으면 저장된 사용자 시간대) 기준으로 계산합니다.

### 1. 오전/오후를 말한 경우
- "오전", "아침", "새벽" → AM, "오후", "저녁", "밤" → PM

### 2. 오전/오후 없이 시각만 말한 경우
- 날짜를 말하지 않았으면 오늘 남은 시각 중 가장 이른 시각으로 정합니다. 예: 현재 14:30에 "11시" → 23:00, 현재 10:00에 "3시" → 15:00
- 오늘 두 시각이 모두 지났거나 날짜를 말했으면 1~6시는 오후, 7~11시는 오전으로 정합니다.
- 날짜 없이 말한 시각이 이미 지났으면 내일로 정합니다.

### 3. 때만 말한 경우
- 아침 09:00, 점심 12:00, 오후 15:00, 저녁 19:00, 밤 21:00, 자정은 다음 날 00:00으로 정합니다.

### 4. 날짜·요일
- "내일" → 다음 날, "모레" → 이틀 후
- 요일만 말하면 오늘을 포함한 가장 가까운 그 요일입니다(금요일에 "금요일" → 오늘). "this Friday"도 같습니다.
- "다음 주 금요일", "next Friday" → 다음 ISO 주(월~일)의 금요일
- "M월 D일"이 이미 지났으면 내년, "N일"이 지났으면 다음 달입니다.

### 5. 기간·반복
- "월요일부터 금요일까지" → startDate + endDate 모두 설정
- 반복 종료를 말하지 않은 반복은 4주 뒤에 끝납니다. 격주·매월처럼 지원하지 않는 반복은 비반복으로 만듭니다.

### 6. 할 일이 아닌 입력
- 모델을 겨냥한 명령만 있는 입력은 제목 "입력 확인 필요"(en: "Needs review")의 오늘 종일 할 일로 응답하며 사용량을 차감하지 않습니다.

## 🚫 사용량 제한
- 무료 유저: **월 5회** (Todo 파싱과 메모 파싱 합산)
- 프리미엄: 무제한 (향후)
- 리셋 시간: KST 매월 1일 00:00

## 💡 입력 예시
| 입력 | 예상 출력 |
|------|----------|
| \`내일 오후 3시에 팀 미팅\` | title: "팀 미팅", startDate: 내일, scheduledTime: "15:00" |
| \`11시에 공부하기\` | title: "공부하기", scheduledTime: 현재시간 기반 AM/PM |
| \`다음주 월요일부터 금요일까지 출장\` | title: "출장", startDate~endDate |
| \`저녁에 운동\` | title: "운동", scheduledTime: "19:00" (오늘 19시가 지났으면 내일) |

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
  @ApiUnprocessableError(ErrorCode.AI_1302)
  @ApiErrorCodesResponse(HttpStatus.TOO_MANY_REQUESTS, [ErrorCode.AI_1303, ErrorCode.AI_1310])
  @ApiForbiddenError(ErrorCode.AI_1311)
  @ApiServiceUnavailableError(ErrorCode.AI_1301)
  @ApiHeader({
    name: "Accept-Language",
    description:
      '파싱 결과 언어 ("ko" | "en"). 미전송 시 저장된 사용자 언어를 사용하고, 없으면 ko입니다.',
    required: false,
    example: "ko",
  })
  async parseTodo(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: ParseTodoRequestDto }) dto: ParseTodoRequestDto,
    @Timezone({ preserveIfMissing: true }) tz: string | undefined,
    @Locale() locale: SupportedLocale | undefined,
  ): Promise<ParseTodoResponseDto> {
    const result = await this.parseTodoUseCase.execute({
      text: dto.text,
      userId: user.userId,
      timezone: tz,
      categoryId: dto.categoryId,
      locale,
    });

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
   * POST /ai/parse-memo
   * { "content": "내일 오후 2시까지 버그 수정하고 정산 로직도 확인. 금요일엔 스터디 자료 올리기", "categoryId": 1 }
   *
   * // Response
   * {
   *   "success": true,
   *   "data": {
   *     "todos": [
   *       {
   *         "title": "버그 수정",
   *         "startDate": "2026-04-12",
   *         "endDate": null,
   *         "scheduledTime": "14:00",
   *         "isAllDay": false,
   *         "isRecurring": false,
   *         "recurrence": null,
   *         "categoryId": 1,
   *         "items": []
   *       },
   *       {
   *         "title": "정산 로직 확인",
   *         "startDate": "2026-04-12",
   *         "endDate": null,
   *         "scheduledTime": null,
   *         "isAllDay": true,
   *         "isRecurring": false,
   *         "recurrence": null,
   *         "categoryId": 1,
   *         "items": []
   *       },
   *       {
   *         "title": "스터디 자료 올리기",
   *         "startDate": "2026-04-17",
   *         "endDate": null,
   *         "scheduledTime": null,
   *         "isAllDay": true,
   *         "isRecurring": false,
   *         "recurrence": null,
   *         "categoryId": 1,
   *         "items": []
   *       }
   *     ]
   *   },
   *   "meta": {
   *     "model": "google:gemini-3.1-flash-lite",
   *     "processingTimeMs": 350,
   *     "tokenUsage": { "input": 450, "output": 280 },
   *     "promptVersion": "parse-memo@v2.1",
   *     "omittedTodoCount": 0
   *   }
   * }
   * ```
   */
  @Post("parse-memo")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiDataSharingConsentGuard, AiUsageGuard)
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 1.13.0 이상이면 AI 데이터 처리 동의가 있어야 처리합니다.",
  })
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 미전송 시 저장된 사용자 타임존을 사용합니다.",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "메모 내용을 다중 할 일 + 서브투두로 파싱",
    operationId: "parseMemoToTodos",
    description: `메모 내용을 AI가 분석하여 여러 개의 구조화된 할 일(각각 서브투두 포함)을 생성합니다.

## 📝 입력 필드
| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| \`content\` | string | 1-5000자 | 파싱할 메모 내용 |
| \`categoryId\` | number | 필수 | 기본 카테고리 ID (생성될 모든 할 일에 적용) |

## 🎯 출력 데이터 (\`data.todos[]\`)
| 필드 | 타입 | 설명 |
|------|------|------|
| \`title\` | string | AI가 추출한 할 일 제목 (1-200자) |
| \`startDate\` | string | 시작 날짜 (YYYY-MM-DD) |
| \`endDate\` | string \\| null | 종료 날짜 (기간 일정용) |
| \`scheduledTime\` | string \\| null | 예정 시간 (HH:mm) |
| \`isAllDay\` | boolean | 종일 여부 |
| \`isRecurring\` | boolean | 반복 일정 여부 |
| \`recurrence\` | object \\| null | 반복 설정 |
| \`categoryId\` | number | 카테고리 ID (요청에서 주입) |
| \`items\` | array | 서브투두 목록 (0-${AI_PARSE_LIMITS.MEMO_MAX_ITEMS}개) |

## 📊 메타데이터 (\`meta\`)
\`model\`, \`processingTimeMs\`, \`tokenUsage\`와 선택 필드 \`promptVersion\`(예: \`parse-memo@v2\`), \`omittedTodoCount\`(${AI_PARSE_LIMITS.MEMO_MAX_TODOS}개를 넘어 만들지 않은 할 일 수)를 반환합니다.

## 🧠 AI 파싱 규칙
- **별개 맥락/주제** → 별도 Todo로 분리합니다. 할 일은 합치지 않고 입력 순서대로 앞의 ${AI_PARSE_LIMITS.MEMO_MAX_TODOS}개까지 만들며, 나머지 수는 \`meta.omittedTodoCount\`로 알립니다. 메모 원문은 그대로 남습니다
- **서브투두가 ${AI_PARSE_LIMITS.MEMO_MAX_ITEMS + 1}개 이상** → 합치지 않고 입력 순서대로 앞의 ${AI_PARSE_LIMITS.MEMO_MAX_ITEMS}개만 남깁니다
- **날짜·시각** → parse-todo와 같은 규칙으로 서버가 사용자 시간대 기준으로 계산합니다
- **모델 대상 명령만 있는 메모** → "입력 확인 필요" 할 일 1개로 응답하며 사용량을 차감하지 않습니다
- **하나의 큰 작업 + 세부 단계** → 1개 Todo + 여러 items (서브투두)
- **날짜/시간 힌트 없음** → 오늘 + 종일
- **반복 표현** (매주, 매일 등) → isRecurring + recurrence 설정

## 💡 입력 → 출력 예시
| 메모 입력 | 예상 결과 |
|----------|----------|
| \`내일 2시까지 버그 수정하고 정산도 확인\` | 2개 Todo: "버그 수정" (내일 14:00), "정산 확인" (내일 종일) |
| \`졸업 발표 준비 - 슬라이드, 대본, 리허설\` | 1개 Todo + 3개 SubTodo |
| \`매주 수요일 학원, 월말까지 포트폴리오\` | 2개 Todo: 반복 + 기간 |
| \`우유 사기\` | 1개 간단 Todo |

## 📱 클라이언트 통합 가이드
\`\`\`
1. POST /ai/parse-memo      → 메모 AI 파싱
2. 사용자에게 결과 표시       → 검토/수정 기회 제공
3. POST /memos/:id/convert-to-todos → 일괄 Todo 생성 + 메모 삭제
\`\`\`

## 🚫 사용량 제한
- 기존 AI 파싱과 **월간 사용량 공유** (parse-todo와 동일 카운트)
- 무료 유저: 월 5회 / 프리미엄: 무제한
- 리셋: KST 매월 1일 00:00`,
  })
  @ApiSuccessResponse({ type: ParseMemoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiUnprocessableError(ErrorCode.AI_1302)
  @ApiErrorCodesResponse(HttpStatus.TOO_MANY_REQUESTS, [ErrorCode.AI_1303, ErrorCode.AI_1310])
  @ApiForbiddenError(ErrorCode.AI_1311)
  @ApiServiceUnavailableError(ErrorCode.AI_1301)
  @ApiHeader({
    name: "Accept-Language",
    description:
      '파싱 결과 언어 ("ko" | "en"). 미전송 시 저장된 사용자 언어를 사용하고, 없으면 ko입니다.',
    required: false,
    example: "ko",
  })
  async parseMemo(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: ParseMemoRequestDto }) dto: ParseMemoRequestDto,
    @Timezone({ preserveIfMissing: true }) tz: string | undefined,
    @Locale() locale: SupportedLocale | undefined,
  ): Promise<ParseMemoResponseDto> {
    const result = await this.parseMemoUseCase.execute({
      content: dto.content,
      userId: user.userId,
      timezone: tz,
      categoryId: dto.categoryId,
      locale,
    });

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
   *     "resetsAt": "2026-04-30T15:00:00.000Z"
   *   }
   * }
   *
   * // Response (프리미엄 유저)
   * {
   *   "success": true,
   *   "data": {
   *     "used": 12,
   *     "limit": null,
   *     "resetsAt": "2026-04-30T15:00:00.000Z"
   *   }
   * }
   * ```
   */
  @Get("usage")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "AI 사용량 조회",
    operationId: "getAiUsage",
    description: `현재 사용자의 월간 AI 사용량을 조회합니다.

## 📊 응답 데이터
| 필드 | 타입 | 설명 |
|------|------|------|
| \`used\` | number | 이번 달 사용한 횟수 |
| \`limit\` | number \\| null | 월간 제한 횟수 (null = 무제한, 프리미엄) |
| \`resetsAt\` | string | 다음 리셋 시간 (ISO 8601, UTC, KST 매월 1일 00:00) |

## ⏰ 리셋 규칙
- 리셋 시간: KST 매월 1일 00:00 (UTC 전월 말일 15:00)
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
  async getUsage(@CurrentUser() user: CurrentUserPayload): Promise<AiUsageResponseDto> {
    const usage = await this.getAiUsageUseCase.execute({ userId: user.userId });

    return {
      success: true,
      data: usage,
    };
  }
}
