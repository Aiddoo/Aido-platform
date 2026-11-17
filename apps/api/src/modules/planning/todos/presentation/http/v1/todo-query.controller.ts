import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { localDateAt } from "../../../../shared/domain/todo-calendar.domain-service.js";
import { GetTodoOverviewUseCase } from "../../../application/use-cases/get-todo-overview.use-case.js";
import { GetTodoResourceLimitUseCase } from "../../../application/use-cases/get-todo-resource-limit.use-case.js";
import { GetTodoSummaryUseCase } from "../../../application/use-cases/get-todo-summary.use-case.js";
import { GetTodoUseCase } from "../../../application/use-cases/get-todo.use-case.js";
import { ListFriendTodosUseCase } from "../../../application/use-cases/list-friend-todos.use-case.js";
import { ListTodosUseCase } from "../../../application/use-cases/list-todos.use-case.js";
import { toFriendTodoResponse, toTodoResponse } from "./todo-response.mapper.js";
import {
  FriendTodoListResponseDto,
  GetFriendTodosQueryDto,
  GetTodosQueryDto,
  TodoIdParamDto,
  TodoListResponseDto,
  TodoOverviewResponseDto,
  TodoResourceLimitQueryDto,
  TodoResourceLimitResponseDto,
  TodoResponseDto,
  TodoSummaryQueryDto,
  TodoSummaryResponseDto,
} from "./todo.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller({ path: "todos", version: API_VERSION.V1 })
export class TodoQueryController {
  readonly #getTodoResourceLimitUseCase: GetTodoResourceLimitUseCase;
  readonly #getTodoSummaryUseCase: GetTodoSummaryUseCase;
  readonly #getTodoOverviewUseCase: GetTodoOverviewUseCase;
  readonly #getTodosUseCase: ListTodosUseCase;
  readonly #getTodoByIdUseCase: GetTodoUseCase;
  readonly #getFriendTodosUseCase: ListFriendTodosUseCase;
  readonly #clock: ClockPort;

  constructor(
    getTodoResourceLimitUseCase: GetTodoResourceLimitUseCase,
    getTodoSummaryUseCase: GetTodoSummaryUseCase,
    getTodoOverviewUseCase: GetTodoOverviewUseCase,
    getTodosUseCase: ListTodosUseCase,
    getTodoByIdUseCase: GetTodoUseCase,
    getFriendTodosUseCase: ListFriendTodosUseCase,
    clock: ClockPort,
  ) {
    this.#getTodoResourceLimitUseCase = getTodoResourceLimitUseCase;
    this.#getTodoSummaryUseCase = getTodoSummaryUseCase;
    this.#getTodoOverviewUseCase = getTodoOverviewUseCase;
    this.#getTodosUseCase = getTodosUseCase;
    this.#getTodoByIdUseCase = getTodoByIdUseCase;
    this.#getFriendTodosUseCase = getFriendTodosUseCase;
    this.#clock = clock;
  }

  @Get("resource-limit")
  @ApiDoc({
    summary: "카테고리당 활성 할 일 리소스 제한 정보 조회",
    operationId: "getTodoResourceLimit",
    description: `카테고리당 활성(미완료) 할 일 최대 한도를 조회합니다.
categoryId를 지정하면 해당 카테고리의 현재 활성 할 일 개수도 함께 반환합니다.

**응답 필드**
- \`maxPerCategory\`: 카테고리당 최대 활성 할 일 수 (모든 구독 동일, ADMIN은 무제한)
- \`activeCount\`: 해당 카테고리의 현재 활성 할 일 개수 (categoryId 지정 시)`,
  })
  @ApiSuccessResponse({ type: TodoResourceLimitResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getResourceLimit(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: TodoResourceLimitQueryDto }) query: TodoResourceLimitQueryDto,
  ): Promise<TodoResourceLimitResponseDto> {
    return this.#getTodoResourceLimitUseCase.execute({
      userId: user.userId,
      categoryId: query.categoryId,
    });
  }

  @Get("summary")
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA, 기본값: UTC) — '오늘' 날짜 경계 판단",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "오늘의 할 일 요약 조회 (홈 위젯용)",
    operationId: "getTodoSummary",
    description: `오늘 할 일 진행률과 현재 스트릭, 상위 할 일 목록을 한 번에 조회합니다.
홈 화면 위젯 스냅샷 갱신용 경량 엔드포인트입니다.

**쿼리**
- \`date\` (선택): 요약할 날짜 (YYYY-MM-DD). \`X-Timezone\` 기준 오늘 또는 내일만 허용하며,
  그 외 날짜는 \`SYS_0002\`(400)입니다. 생략하면 오늘입니다. 위젯이 자정 이후 표시할 내일 요약을 미리 받습니다.

**응답 필드**
- \`date\`: 조회 기준 날짜 (YYYY-MM-DD, 요청한 \`date\` 또는 \`X-Timezone\` 헤더 기준 로컬 "오늘")
- \`totalTodos\` / \`completedTodos\`: 오늘 전체/완료 할 일 개수
- \`completionRate\`: 완료율 (0-100, round(완료/전체 × 100), 할 일 없으면 0)
- \`isComplete\`: 100% 달성 여부 (할 일이 1개 이상이고 전부 완료)
- \`currentStreak\`: 현재 연속 달성 일수
- \`topTodos\`: 오늘 할 일 상위 목록 (미완료 우선, 이후 카테고리/정렬 순 — 최대 10개)`,
  })
  @ApiSuccessResponse({ type: TodoSummaryResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Timezone() timezone: string,
    @Query({ schema: TodoSummaryQueryDto }) query: TodoSummaryQueryDto,
  ): Promise<TodoSummaryResponseDto> {
    return this.#getTodoSummaryUseCase.execute({
      userId: user.userId,
      today: localDateAt(this.#clock.now(), timezone),
      requestedDate: query.date == null ? undefined : Temporal.PlainDate.from(query.date),
    });
  }

  @Get("overview")
  @ApiDoc({
    summary: "할 일 개요 조회 (할 일·완료·진행 중 반복이 있는지)",
    operationId: "getTodoOverview",
    description: `날짜와 상관없이 이 계정에 할 일·완료한 할 일·진행 중인 반복이 있는지 한 번에 조회합니다.
목록을 받아 앱이 다시 판단하지 않도록 서버가 계산한 값입니다. 날짜 경계가 없어 \`X-Timezone\`을 읽지 않습니다.

**응답 필드**
- \`hasTodo\`: 할 일이 하나라도 있는지 (지운 할 일은 세지 않음)
- \`hasCompletedTodo\`: 완료한 할 일이 하나라도 있는지 (완료를 풀면 세지 않음)
- \`hasActiveRepeat\`: 진행 중인 반복이 하나라도 있는지. 앞으로 만들 회차가 남은 반복 규칙이고, 진행 중 반복 상한(\`TODO_0842\`)이 세는 규칙과 같습니다.
  - 그만뒀거나 남은 회차를 이미 모두 만든 규칙(종료일·횟수가 미리 만드는 ${TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS}일 안에서 끝남)은 세지 않습니다.
  - 오래 앱을 열지 않아 멈춘(휴면) 규칙은 끝난 것이 아니라 셉니다. 응답 전에 복귀 처리를 기다려 휴면 중 종료일·횟수가 지난 규칙은 끝난 것으로 답합니다.`,
  })
  @ApiSuccessResponse({ type: TodoOverviewResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getOverview(@CurrentUser() user: CurrentUserPayload): Promise<TodoOverviewResponseDto> {
    return this.#getTodoOverviewUseCase.execute({ userId: user.userId });
  }

  @Get()
  @ApiDoc({
    summary: "할 일 목록 조회",
    operationId: "getTodos",
    description: `사용자의 할 일 목록을 커서 기반 페이지네이션으로 조회합니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`size\`: 페이지 크기 (1-200, 기본값: 20)
- \`completed\`: 완료 상태 필터
- \`categoryId\`: 카테고리 ID 필터
- \`startDate\`: 시작일 필터 (YYYY-MM-DD)
- \`endDate\`: 종료일 필터 (YYYY-MM-DD)

---

### 정렬 (Sort Order)

응답 데이터는 다음 기준으로 정렬됩니다:

1. \`category.sortOrder\` ASC — 카테고리 순서
2. \`todo.sortOrder\` ASC — 카테고리 내 할 일 순서
3. \`todo.id\` ASC — 동일 순서 시 ID 기준 안정 정렬

이 정렬 덕분에 데이터가 카테고리 순서대로 연속으로 반환되므로,
클라이언트에서 \`Map.groupBy(todos, (t) => t.category.id)\`로 그룹핑하면
카테고리별 할 일 목록을 구성할 수 있습니다.

\`categoryId\` 파라미터 없이 호출하면 모든 카테고리의 할 일이 카테고리 순서대로 반환됩니다.
\`categoryId\`를 지정하면 해당 카테고리의 할 일만 반환됩니다.

**카테고리 정보**: 각 할 일의 \`category\` 객체에 \`sortOrder\` 필드가 포함되어 있어
클라이언트 그룹핑 시 정렬 키로 활용할 수 있습니다.

---

### 날짜 필터링 (Overlapping Intervals)

날짜 필터는 **DATE(날짜) 기준**으로 동작합니다. 타임존 변환이 적용되지 않는 floating date입니다.

#### 사용 시나리오

| startDate | endDate | 결과 |
|-----------|---------|------|
| 미지정 | 미지정 | 전체 할 일 반환 |
| 2026-01-15 | 2026-01-15 | **특정 날짜**에 해당하는 할 일 (단일 날짜 조회) |
| 2026-01-01 | 2026-01-31 | **기간 범위**에 걸쳐 있는 할 일 (월간/주간 뷰) |
| 2026-01-15 | 미지정 | **해당 날짜**에 해당하는 할 일 (exact match) |
| 미지정 | 2026-01-31 | **해당 날짜**에 해당하는 할 일 (exact match) |

#### 필터링 로직 상세

- **다일(multi-day) 할 일**: \`todo.startDate <= endDate\` AND \`todo.endDate >= startDate\`
- **단일 날짜 할 일** (endDate가 없는 경우): \`todo.startDate\`가 필터 범위 내에 있는지 확인

#### 시간 처리 (scheduledTime)

- **종일 이벤트** (\`isAllDay=true\`): \`scheduledTime\`은 null
- **시간 이벤트** (\`isAllDay=false\`): \`scheduledLocalTime\`(HH:mm)이 사용자가 고른 시각이고 어디서든 그 시각입니다
  - \`scheduledTime\`(UTC ISO 8601)은 날짜 + 벽시계 + 사용자 시간대로 만든 파생값이고 시간대가 바뀌면 다시 계산됩니다
  - 표시는 \`scheduledLocalTime\`을 그대로 씁니다. 키가 없는 옛 서버 응답에서만 \`scheduledTime\`을 기기 시간대로 바꿉니다

#### 에러 케이스

| 케이스 | 응답 |
|--------|------|
| startDate가 endDate보다 이후 | \`400 Bad Request\` (SYS_0002) |
| 잘못된 날짜 형식 (예: 2026-13-01) | \`400 Bad Request\` (SYS_0002) |
| 유효하지 않은 날짜 (예: 2026-02-30) | \`400 Bad Request\` (SYS_0002) |

#### 예시

1. **2026-01-10에 시작하여 2026-01-20에 끝나는 할 일**이 있을 때:
   - \`startDate=2026-01-15&endDate=2026-01-15\` → ✅ 반환 (기간이 겹침)
   - \`startDate=2026-01-01&endDate=2026-01-05\` → ❌ 미반환 (기간이 겹치지 않음)
   - \`startDate=2026-01-25&endDate=2026-01-31\` → ❌ 미반환 (기간이 겹치지 않음)

2. **2026-01-15에만 해당하는 단일 날짜 할 일**이 있을 때:
   - \`startDate=2026-01-15&endDate=2026-01-15\` → ✅ 반환
   - \`startDate=2026-01-10&endDate=2026-01-20\` → ✅ 반환 (범위 내에 포함)
   - \`startDate=2026-01-16&endDate=2026-01-20\` → ❌ 미반환`,
  })
  @ApiSuccessResponse({ type: TodoListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async findMany(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetTodosQueryDto }) query: GetTodosQueryDto,
  ): Promise<TodoListResponseDto> {
    const result = await this.#getTodosUseCase.execute({
      userId: user.userId,
      cursor: query.cursor,
      size: query.size,
      completed: query.completed,
      categoryId: query.categoryId,
      // DATE 타입 필드는 시간 정보가 없으므로 parseDateOnly 사용
      startDate: query.startDate == null ? undefined : Temporal.PlainDate.from(query.startDate),
      endDate: query.endDate == null ? undefined : Temporal.PlainDate.from(query.endDate),
    });

    return {
      items: result.items.map(toTodoResponse),
      pagination: result.pagination,
    };
  }

  @Get(":id")
  @ApiDoc({
    summary: "할 일 상세 조회",
    operationId: "getTodoById",
    description: `특정 할 일의 상세 정보를 조회합니다.

본인 소유의 할 일만 조회할 수 있습니다.`,
  })
  @ApiSuccessResponse({ type: TodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.#getTodoByIdUseCase.execute({
      id: params.id,
      userId: user.userId,
    });
    return toTodoResponse(todo);
  }

  @Get("friends/:userId")
  @ApiDoc({
    summary: "친구의 할 일 목록 조회",
    operationId: "getFriendTodos",
    description: `친구의 공개(PUBLIC) 할 일 목록을 조회합니다.

맞팔 관계여야만 조회 가능하며, PRIVATE 할 일은 표시되지 않습니다.

**쿼리 파라미터**
- \`cursor\`: 페이지네이션 커서
- \`size\`: 페이지 크기 (1-200, 기본값: 20)
- \`startDate\`: 시작일 필터 (YYYY-MM-DD)
- \`endDate\`: 종료일 필터 (YYYY-MM-DD)

---

### 정렬

\`GET /todos\` API와 동일한 정렬 순서를 사용합니다:
\`category.sortOrder\` ASC → \`todo.sortOrder\` ASC → \`todo.id\` ASC

---

### 날짜 필터링

날짜 필터링은 \`GET /todos\` API와 동일한 Overlapping Intervals 로직을 사용합니다.
단일 날짜만 전달 시 해당 날짜의 할 일만 반환합니다 (exact match).
자세한 내용은 해당 API 문서를 참조하세요.

#### 에러 케이스

| 케이스 | 응답 |
|--------|------|
| 맞팔 관계가 아닌 경우 | \`403 Forbidden\` (FOLLOW_0906) |
| startDate가 endDate보다 이후 | \`400 Bad Request\` (SYS_0002) |
| 잘못된 날짜 형식 | \`400 Bad Request\` (SYS_0002) |`,
  })
  @ApiSuccessResponse({ type: FriendTodoListResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.FOLLOW_0906)
  async findFriendTodos(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
    @Query({ schema: GetFriendTodosQueryDto }) query: GetFriendTodosQueryDto,
  ): Promise<FriendTodoListResponseDto> {
    const result = await this.#getFriendTodosUseCase.execute({
      userId: user.userId,
      friendUserId: params.userId,
      cursor: query.cursor,
      size: query.size,
      // DATE 타입 필드는 시간 정보가 없으므로 parseDateOnly 사용
      startDate: query.startDate == null ? undefined : Temporal.PlainDate.from(query.startDate),
      endDate: query.endDate == null ? undefined : Temporal.PlainDate.from(query.endDate),
    });

    return {
      items: result.items.map(toFriendTodoResponse),
      pagination: result.pagination,
    };
  }
}
