import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ApplicationException } from "#api/shared/application/application.exception";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCategoryId } from "../../../../categories/domain/todo-category-id.vo.js";
import { localDateAt } from "../../../../shared/domain/todo-calendar.domain-service.js";
import { toTodoSeriesResponse } from "../../../../todo-series/presentation/http/v1/todo-series-response.mapper.js";
import { AddTodoItemUseCase } from "../../../application/use-cases/add-todo-item.use-case.js";
import { ChangeTodoCategoryUseCase } from "../../../application/use-cases/change-todo-category.use-case.js";
import { CreateTodoUseCase } from "../../../application/use-cases/create-todo.use-case.js";
import { DeleteTodoItemUseCase } from "../../../application/use-cases/delete-todo-item.use-case.js";
import { DeleteTodoUseCase } from "../../../application/use-cases/delete-todo.use-case.js";
import { EditTodoUseCase } from "../../../application/use-cases/edit-todo.use-case.js";
import { GetTodoOverviewUseCase } from "../../../application/use-cases/get-todo-overview.use-case.js";
import { GetTodoResourceLimitUseCase } from "../../../application/use-cases/get-todo-resource-limit.use-case.js";
import { GetTodoSummaryUseCase } from "../../../application/use-cases/get-todo-summary.use-case.js";
import { GetTodoUseCase } from "../../../application/use-cases/get-todo.use-case.js";
import { ListFriendTodosUseCase } from "../../../application/use-cases/list-friend-todos.use-case.js";
import { ListTodosUseCase } from "../../../application/use-cases/list-todos.use-case.js";
import { ReorderTodoItemsUseCase } from "../../../application/use-cases/reorder-todo-items.use-case.js";
import { ReorderTodoUseCase } from "../../../application/use-cases/reorder-todo.use-case.js";
import { SetTodoCompletedUseCase } from "../../../application/use-cases/set-todo-completed.use-case.js";
import { UpdateTodoItemUseCase } from "../../../application/use-cases/update-todo-item.use-case.js";
import { UpdateTodoScheduleUseCase } from "../../../application/use-cases/update-todo-schedule.use-case.js";
import { UpdateTodoTitleUseCase } from "../../../application/use-cases/update-todo-title.use-case.js";
import { UpdateTodoVisibilityUseCase } from "../../../application/use-cases/update-todo-visibility.use-case.js";
import { toFriendTodoResponse, toTodoResponse } from "./todo-response.mapper.js";
import {
  ChangeTodoCategoryDto,
  CreateRecurringTodoDto,
  CreateRecurringTodoResponseDto,
  CreateTodoDto,
  CreateTodoItemDto,
  CreateTodoResponseDto,
  DeleteTodoQueryDto,
  DeleteTodoResponseDto,
  FriendTodoListResponseDto,
  GetFriendTodosQueryDto,
  GetTodosQueryDto,
  ReorderTodoDto,
  ReorderTodoItemsDto,
  ReorderTodoResponseDto,
  TodoIdParamDto,
  TodoItemIdParamDto,
  TodoListResponseDto,
  TodoOverviewResponseDto,
  TodoResourceLimitQueryDto,
  TodoResourceLimitResponseDto,
  TodoResponseDto,
  TodoSummaryQueryDto,
  TodoSummaryResponseDto,
  ToggleTodoCompleteDto,
  UpdateTodoDto,
  UpdateTodoItemDto,
  UpdateTodoResponseDto,
  UpdateTodoScheduleDto,
  UpdateTodoTitleDto,
  UpdateTodoVisibilityDto,
} from "./todo.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller("todos")
export class TodoController {
  readonly #getTodoResourceLimitUseCase: GetTodoResourceLimitUseCase;
  readonly #getTodoSummaryUseCase: GetTodoSummaryUseCase;
  readonly #getTodoOverviewUseCase: GetTodoOverviewUseCase;
  readonly #getTodosUseCase: ListTodosUseCase;
  readonly #getTodoByIdUseCase: GetTodoUseCase;
  readonly #getFriendTodosUseCase: ListFriendTodosUseCase;
  readonly #createTodoUseCase: CreateTodoUseCase;
  readonly #editTodoUseCase: EditTodoUseCase;
  readonly #toggleTodoCompleteUseCase: SetTodoCompletedUseCase;
  readonly #updateTodoVisibilityUseCase: UpdateTodoVisibilityUseCase;
  readonly #changeTodoCategoryUseCase: ChangeTodoCategoryUseCase;
  readonly #updateTodoScheduleUseCase: UpdateTodoScheduleUseCase;
  readonly #updateTodoTitleUseCase: UpdateTodoTitleUseCase;
  readonly #reorderTodoUseCase: ReorderTodoUseCase;
  readonly #deleteTodoUseCase: DeleteTodoUseCase;
  readonly #addTodoItemUseCase: AddTodoItemUseCase;
  readonly #reorderTodoItemsUseCase: ReorderTodoItemsUseCase;
  readonly #updateTodoItemUseCase: UpdateTodoItemUseCase;
  readonly #deleteTodoItemUseCase: DeleteTodoItemUseCase;
  readonly #clock: ClockPort;

  constructor(
    getTodoResourceLimitUseCase: GetTodoResourceLimitUseCase,
    getTodoSummaryUseCase: GetTodoSummaryUseCase,
    getTodoOverviewUseCase: GetTodoOverviewUseCase,
    getTodosUseCase: ListTodosUseCase,
    getTodoByIdUseCase: GetTodoUseCase,
    getFriendTodosUseCase: ListFriendTodosUseCase,
    createTodoUseCase: CreateTodoUseCase,
    editTodoUseCase: EditTodoUseCase,
    toggleTodoCompleteUseCase: SetTodoCompletedUseCase,
    updateTodoVisibilityUseCase: UpdateTodoVisibilityUseCase,
    changeTodoCategoryUseCase: ChangeTodoCategoryUseCase,
    updateTodoScheduleUseCase: UpdateTodoScheduleUseCase,
    updateTodoTitleUseCase: UpdateTodoTitleUseCase,
    reorderTodoUseCase: ReorderTodoUseCase,
    deleteTodoUseCase: DeleteTodoUseCase,
    addTodoItemUseCase: AddTodoItemUseCase,
    reorderTodoItemsUseCase: ReorderTodoItemsUseCase,
    updateTodoItemUseCase: UpdateTodoItemUseCase,
    deleteTodoItemUseCase: DeleteTodoItemUseCase,
    clock: ClockPort,
  ) {
    this.#getTodoResourceLimitUseCase = getTodoResourceLimitUseCase;
    this.#getTodoSummaryUseCase = getTodoSummaryUseCase;
    this.#getTodoOverviewUseCase = getTodoOverviewUseCase;
    this.#getTodosUseCase = getTodosUseCase;
    this.#getTodoByIdUseCase = getTodoByIdUseCase;
    this.#getFriendTodosUseCase = getFriendTodosUseCase;
    this.#createTodoUseCase = createTodoUseCase;
    this.#editTodoUseCase = editTodoUseCase;
    this.#toggleTodoCompleteUseCase = toggleTodoCompleteUseCase;
    this.#updateTodoVisibilityUseCase = updateTodoVisibilityUseCase;
    this.#changeTodoCategoryUseCase = changeTodoCategoryUseCase;
    this.#updateTodoScheduleUseCase = updateTodoScheduleUseCase;
    this.#updateTodoTitleUseCase = updateTodoTitleUseCase;
    this.#reorderTodoUseCase = reorderTodoUseCase;
    this.#deleteTodoUseCase = deleteTodoUseCase;
    this.#addTodoItemUseCase = addTodoItemUseCase;
    this.#reorderTodoItemsUseCase = reorderTodoItemsUseCase;
    this.#updateTodoItemUseCase = updateTodoItemUseCase;
    this.#deleteTodoItemUseCase = deleteTodoItemUseCase;
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

  @Post()
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 없으면 저장된 사용자 시간대",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "할 일 생성",
    operationId: "createTodo",
    description: `새로운 할 일을 생성합니다.

**필수 필드**
- \`title\`: 할 일 제목 (1-200자)
- \`categoryId\`: 카테고리 ID
- \`startDate\`: 시작 날짜 (YYYY-MM-DD)

**선택 필드**
- \`endDate\`: 종료 날짜 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm, 24시간 형식). 어디서든 그 시각입니다. 순간은 \`X-Timezone\`(없으면 저장된 사용자 시간대)으로 만듭니다.
- \`isAllDay\`: 종일 여부 (기본값: true)
- \`visibility\`: 공개 범위 (PUBLIC/PRIVATE, 기본값: PUBLIC)
- \`items\`: 하위 항목 배열 (선택, 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개). 투두와 함께 체크리스트를 일괄 생성합니다.
- \`repeat\`: 반복 규칙 (선택). 있으면 \`endDate\`는 비워야 하고, 앞으로 ${TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS}일 치 회차를 만듭니다. 응답의 \`todo\`는 첫 회차, \`series\`는 규칙입니다. 체크리스트는 회차마다 복사합니다.

---

### 하위 항목 (체크리스트)

\`items\` 배열을 전달하면 투두 생성과 동시에 체크리스트가 생성됩니다.
각 항목은 \`{ title: string }\` 형태이며, 배열 순서가 \`sortOrder\`로 지정됩니다.

### 제한사항

| 항목 | 제한 |
|------|------|
| 카테고리당 활성(미완료) 할 일 | 최대 300개 |
| 투두당 하위 항목 | 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개 |
| 하위 항목 제목 | 1-200자 |

### 응답의 items / itemStats 필드

모든 할 일 응답에 다음 필드가 포함됩니다:
- \`items\`: 하위 항목 배열 (\`sortOrder\` 오름차순, 없으면 빈 배열 \`[]\`)
- \`itemStats.total\`: 전체 하위 항목 수
- \`itemStats.completed\`: 완료된 하위 항목 수

클라이언트 활용:
- **카운터 뱃지**: \`itemStats.completed\` / \`itemStats.total\` (예: 1/3)
- **진행률 바**: \`itemStats.completed / itemStats.total * 100\` (예: 33%)
- **펼침/접힘 토글**: \`itemStats.total > 0\`이면 토글 버튼 표시`,
  })
  @ApiCreatedResponse({ type: CreateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
  @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [
    ErrorCode.TODO_0811,
    ErrorCode.TODO_0813,
    ErrorCode.TODO_0842,
  ])
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [ErrorCode.TODO_0843, ErrorCode.TODO_0845])
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateTodoDto }) dto: CreateTodoDto,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<CreateTodoResponseDto> {
    const { todos, series } = await this.#createTodoUseCase.execute({
      userId: UserId.reconstitute(user.userId),
      title: dto.title,
      categoryId: TodoCategoryId.reconstitute(dto.categoryId),
      startDate: Temporal.PlainDate.from(dto.startDate),
      endDate: dto.endDate == null ? undefined : Temporal.PlainDate.from(dto.endDate),
      scheduledTime: dto.scheduledTime,
      timezone,
      isAllDay: dto.isAllDay,
      visibility: dto.visibility,
      items: dto.items,
      repeat: dto.repeat,
    });
    const todo = todos.at(0);
    if (todo == null) {
      throw new ApplicationException(ErrorCode.SYS_0001, { reason: "created todo missing" });
    }

    return {
      message: "할 일이 생성되었습니다.",
      todo: toTodoResponse(todo),
      ...(series != null && { series: toTodoSeriesResponse(series) }),
    };
  }

  @Post("recurring")
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 없으면 저장된 사용자 시간대",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "반복 할 일 생성 (출시 앱 호환)",
    operationId: "createRecurringTodo",
    deprecated: true,
    description: `지원하는 마지막 앱 버전: 1.14.x. 새 앱은 \`POST /todos\`의 \`repeat\`를 씁니다.

날짜 범위와 요일 조합에 따라 반복 할 일을 만듭니다. 앞으로 ${TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS}일 치 회차를 만들고 나머지는 매일 작업이 채웁니다.

**필수 필드**
- \`title\`: 할 일 제목 (1-200자)
- \`categoryId\`: 카테고리 ID
- \`startDate\`: 반복 시작 날짜 (YYYY-MM-DD)
- \`endDate\`: 반복 종료 날짜 (YYYY-MM-DD)
- \`daysOfWeek\`: 반복할 요일 배열 (MON/TUE/WED/THU/FRI/SAT/SUN)

**예시**: 3월 1일~31일, 매주 월/수/금 → 약 13개의 할 일 생성

**응답**
- \`count\`: 이번에 만든 할 일 수

**제한사항**
- 카테고리 한도를 초과하면 전체 요청 거부
- 진행 중인 반복이 ${TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY}개면 \`TODO_0813\`으로 거부`,
  })
  @ApiCreatedResponse({ type: CreateRecurringTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.TODO_0812)
  @ApiForbiddenError(ErrorCode.TODO_0813)
  @ApiNotFoundError(ErrorCode.TODO_CATEGORY_0851)
  async createRecurring(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateRecurringTodoDto }) dto: CreateRecurringTodoDto,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<CreateRecurringTodoResponseDto> {
    const { todos } = await this.#createTodoUseCase
      .execute({
        userId: UserId.reconstitute(user.userId),
        title: dto.title,
        categoryId: TodoCategoryId.reconstitute(dto.categoryId),
        startDate: Temporal.PlainDate.from(dto.startDate),
        scheduledTime: dto.scheduledTime,
        timezone,
        isAllDay: dto.isAllDay,
        visibility: dto.visibility,
        repeat: {
          frequency: "WEEKLY",
          interval: 1,
          weekdays: dto.daysOfWeek,
          end: { type: "UNTIL", date: dto.endDate },
        },
        usesLegacySeriesLimit: true,
      })
      .catch((error: unknown) => {
        // 출시 앱 계약: 이 경로의 날짜 없음은 SYS_0002다. TODO_0843은 새 경로의 코드다.
        if (error instanceof DomainException && error.errorCode === ErrorCode.TODO_0843) {
          throw new ApplicationException(ErrorCode.SYS_0002, {
            message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
            startDate: dto.startDate,
            endDate: dto.endDate,
            daysOfWeek: dto.daysOfWeek,
          });
        }
        throw error;
      });

    return {
      message: `반복 할 일이 ${todos.length}개 생성되었습니다.`,
      todos: todos.map(toTodoResponse),
      count: todos.length,
    };
  }

  @Get()
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "페이지네이션 커서 (다음 페이지 요청 시 이전 응답의 nextCursor 값 사용)",
    schema: { type: "number" },
    example: 123,
  })
  @ApiQuery({
    name: "size",
    required: false,
    description: "페이지 크기 (1-200)",
    schema: { type: "number", minimum: 1, maximum: 200, default: 20 },
    example: 20,
  })
  @ApiQuery({
    name: "completed",
    required: false,
    description: "완료 상태 필터 (true: 완료만, false: 미완료만, 미지정: 전체)",
    schema: { type: "boolean" },
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    description: "카테고리 ID 필터 (특정 카테고리의 할 일만 조회)",
    schema: { type: "number" },
    example: 1,
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    description:
      "시작일 (YYYY-MM-DD). 단독 사용 시 해당 날짜의 할 일만 반환합니다. endDate와 함께 사용 시 범위 조회합니다.",
    schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    example: "2026-01-01",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    description:
      "종료일 (YYYY-MM-DD). 단독 사용 시 해당 날짜의 할 일만 반환합니다. startDate와 함께 사용 시 범위 조회합니다. startDate보다 이전 날짜를 지정하면 400 에러가 발생합니다.",
    schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    example: "2026-01-31",
  })
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

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 없으면 저장된 사용자 시간대",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "할 일 수정",
    operationId: "updateTodo",
    description: `할 일의 정보를 부분 수정합니다.

**수정 가능 필드**: title, categoryId, startDate, endDate, scheduledTime, isAllDay, visibility, completed

**반복 할 일**
- \`scope\`: 생략하거나 \`THIS_ONLY\`면 이 회차만 고칩니다. 옮겨도 원래 회차 날짜는 그대로라 다시 만들어지지 않습니다.
- \`scope=THIS_AND_FOLLOWING\`: 이 회차와 이후 미완료 회차를 고칩니다. 완료한 회차는 그대로입니다. 첫 회차에서 고르면 전체를 고칩니다. 날짜·완료는 이 회차에만 적용합니다.
- \`repeat\`: 생략은 변경 없음, \`null\`은 이 회차 뒤로 반복 끝내기, 값은 단일 할 일을 반복으로 전환하거나 \`scope=THIS_AND_FOLLOWING\`과 함께 규칙을 바꿉니다.
- \`checklist\`: \`scope=THIS_AND_FOLLOWING\` 전용. 새로 만드는 회차에 복사합니다. 이미 만든 회차의 진행은 그대로입니다.`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [
    ErrorCode.TODO_0801,
    ErrorCode.TODO_0841,
    ErrorCode.TODO_CATEGORY_0851,
  ])
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [
    ErrorCode.TODO_0843,
    ErrorCode.TODO_0844,
    ErrorCode.TODO_0845,
  ])
  @ApiForbiddenError(ErrorCode.TODO_0842)
  @ApiConflictError(ErrorCode.TODO_0846)
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: UpdateTodoDto }) dto: UpdateTodoDto,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#editTodoUseCase.execute({
      id: params.id,
      userId: user.userId,
      timezone,
      scope: dto.scope,
      repeat: dto.repeat,
      checklist: dto.checklist,
      data: {
        title: dto.title,
        categoryId: dto.categoryId,
        startDate: dto.startDate == null ? undefined : Temporal.PlainDate.from(dto.startDate),
        endDate:
          // oxlint-disable-next-line aido/no-strict-nullish -- PATCH라 undefined는 유지, null은 종료일 지우기다
          dto.endDate === undefined
            ? undefined
            : // oxlint-disable-next-line aido/no-strict-nullish -- PATCH라 undefined는 유지, null은 종료일 지우기다
              dto.endDate === null
              ? null
              : Temporal.PlainDate.from(dto.endDate),
        scheduledTime: dto.scheduledTime,
        isAllDay: dto.isAllDay,
        visibility: dto.visibility,
        completed: dto.completed,
      },
    });

    return {
      message: "할 일이 수정되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/complete")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 없으면 저장된 사용자 시간대",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "할 일 완료 상태 토글",
    operationId: "toggleTodoComplete",
    description: `할 일의 완료 상태를 변경합니다.

**요청 필드**: \`completed\` (boolean, 필수)

**하위 항목과의 관계**
- 부모 할 일의 완료/미완료는 하위 항목의 완료 상태에 **영향을 주지 않습니다**
- 하위 항목이 전부 완료(3/3)되어도 부모 할 일은 **자동 완료되지 않습니다**
- 부모 할 일의 완료 여부만 스트릭/마일스톤/일일 완료 알림에 반영됩니다
- 하위 항목의 완료 토글은 \`PATCH /todos/:id/items/:itemId\` API를 사용하세요`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async toggleComplete(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: ToggleTodoCompleteDto }) dto: ToggleTodoCompleteDto,
    @Timezone() timezone: string,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#toggleTodoCompleteUseCase.execute({
      id: params.id,
      userId: user.userId,
      completed: dto.completed,
      timezone,
    });

    return {
      message: dto.completed ? "할 일이 완료되었습니다." : "할 일이 미완료로 변경되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/visibility")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "할 일 공개 범위 변경",
    operationId: "updateTodoVisibility",
    description: `할 일의 공개 범위를 변경합니다.

**요청 필드**: \`visibility\` (PUBLIC/PRIVATE, 필수)`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async updateVisibility(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: UpdateTodoVisibilityDto }) dto: UpdateTodoVisibilityDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#updateTodoVisibilityUseCase.execute({
      id: params.id,
      userId: user.userId,
      visibility: dto.visibility,
    });

    return {
      message: `공개 범위가 ${dto.visibility}로 변경되었습니다.`,
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/category")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "할 일 카테고리 변경",
    operationId: "updateTodoCategory",
    description: `할 일의 카테고리를 변경합니다.

**요청 필드**: \`categoryId\` (number, 필수)`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_CATEGORY_0851])
  async updateCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: ChangeTodoCategoryDto }) dto: ChangeTodoCategoryDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#changeTodoCategoryUseCase.execute({
      id: params.id,
      userId: user.userId,
      categoryId: dto.categoryId,
    });

    return {
      message: "카테고리가 변경되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/schedule")
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: "X-Timezone",
    required: false,
    description: "사용자 타임존 (IANA). 없으면 저장된 사용자 시간대",
    example: "Asia/Seoul",
  })
  @ApiDoc({
    summary: "할 일 일정 변경",
    operationId: "updateTodoSchedule",
    description: `할 일의 날짜와 시간을 변경합니다.

**요청 필드** (\`startDate\` 필수, 나머지 선택)
- \`startDate\`: 시작일 (YYYY-MM-DD)
- \`endDate\`: 종료일 (YYYY-MM-DD)
- \`scheduledTime\`: 예정 시간 (HH:mm, 24시간 형식). 어디서든 그 시각입니다. 순간은 \`X-Timezone\`(없으면 저장된 사용자 시간대)으로 만듭니다.
- \`isAllDay\`: 종일 여부`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async updateSchedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: UpdateTodoScheduleDto }) dto: UpdateTodoScheduleDto,
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#updateTodoScheduleUseCase.execute({
      id: params.id,
      userId: user.userId,
      schedule: {
        startDate: Temporal.PlainDate.from(dto.startDate),
        endDate: dto.endDate == null ? null : Temporal.PlainDate.from(dto.endDate),
        scheduledTime: dto.scheduledTime ?? null,
        isAllDay: dto.isAllDay ?? true,
      },
      timezone,
    });

    return {
      message: "일정이 변경되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/title")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "할 일 제목 수정",
    operationId: "updateTodoTitle",
    description: `할 일의 제목을 수정합니다.

**요청 필드**
- \`title\`: 할 일 제목 (1-200자, 필수)`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async updateTitle(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: UpdateTodoTitleDto }) dto: UpdateTodoTitleDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#updateTodoTitleUseCase.execute({
      id: params.id,
      userId: user.userId,
      title: dto.title,
    });

    return {
      message: "할 일이 수정되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/reorder")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "할 일 순서 변경",
    operationId: "reorderTodo",
    description: `할 일을 다른 할 일의 앞 또는 뒤로 이동합니다. 드래그 앤 드롭 UI에 적합합니다.

**요청 필드**
- \`targetTodoId\` (선택): 기준이 되는 할 일 ID. 생략 시 맨 앞/뒤로 이동
- \`position\` (필수): 기준 할 일의 앞(\`before\`) 또는 뒤(\`after\`)`,
  })
  @ApiSuccessResponse({ type: ReorderTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async reorder(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: ReorderTodoDto }) dto: ReorderTodoDto,
  ): Promise<ReorderTodoResponseDto> {
    const todo = await this.#reorderTodoUseCase.execute({
      id: params.id,
      userId: user.userId,
      targetTodoId: dto.targetTodoId,
      position: dto.position,
    });

    return {
      message: "할 일 순서가 변경되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "할 일 삭제",
    operationId: "deleteTodo",
    description: `특정 할 일을 삭제합니다. 삭제된 할 일은 복구할 수 없습니다.

할 일을 삭제하면 해당 투두의 모든 하위 항목도 함께 삭제됩니다 (Cascade).

**반복 할 일** (\`scope\`)
- 생략하거나 \`THIS_ONLY\`: 이 회차만 지웁니다. 횟수 종료에서는 지운 날짜도 횟수에 셉니다.
- \`THIS_AND_FOLLOWING\`: 이 회차와 이후 미완료 회차를 지우고 반복을 끝냅니다. 완료한 회차는 남습니다.
- \`ALL\`: 완료한 회차까지 모두 지웁니다.`,
  })
  @ApiSuccessResponse({ type: DeleteTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0841])
  @ApiBadRequestError(ErrorCode.TODO_0844)
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Query({ schema: DeleteTodoQueryDto }) query: DeleteTodoQueryDto,
  ): Promise<DeleteTodoResponseDto> {
    await this.#deleteTodoUseCase.execute({
      id: params.id,
      userId: user.userId,
      scope: query.scope,
    });

    return {
      message: "할 일이 삭제되었습니다.",
    };
  }

  // ===== 하위 항목 (체크리스트) 관리 =====
  // 선언 순서: POST → reorder(정적) → PATCH :itemId(동적) → DELETE :itemId

  @Post(":id/items")
  @ApiDoc({
    summary: "하위 항목 추가",
    operationId: "addTodoItem",
    description: `할 일에 하위 항목(체크리스트)을 추가합니다.

**요청 필드**
- \`title\` (필수): 하위 항목 제목 (1-200자)

**동작**
- 새 항목은 기존 항목 맨 뒤에 추가됩니다 (\`sortOrder\` 자동 증가)
- 완료한 할 일에 추가하면 할 일이 미완료로 돌아갑니다
- 투두당 최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개까지 추가 가능

**응답**
- 부모 할 일 전체 객체를 반환합니다 (\`items\`, \`itemStats\` 포함)
- 클라이언트는 응답의 \`todo\` 객체로 로컬 상태를 교체하면 됩니다

**참고**
- 하위 항목은 카테고리당 활성 할 일 한도(300개)에 포함되지 않습니다
- 하위 항목은 스트릭/마일스톤/일일 완료 알림에 영향을 주지 않습니다

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 한도 초과 (${TODO_ITEM_LIMITS.MAX_PER_TODO}개) | TODO_0821 | 403 |
| 유효성 검증 실패 | SYS_0002 | 400 |`,
  })
  @ApiCreatedResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  @ApiForbiddenError(ErrorCode.TODO_0821)
  async addItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: CreateTodoItemDto }) dto: CreateTodoItemDto,
    @Timezone() timezone: string,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#addTodoItemUseCase.execute({
      todoId: params.id,
      userId: user.userId,
      title: dto.title,
      timezone,
    });

    return {
      message: "하위 항목이 추가되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/items/reorder")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "하위 항목 순서 변경",
    operationId: "reorderTodoItems",
    description: `하위 항목의 순서를 일괄 변경합니다. 드래그 앤 드롭 UI에 적합합니다.

**요청 필드**
- \`itemIds\` (필수): 새로운 순서대로 정렬된 하위 항목 ID 배열

**사용법**
배열의 인덱스가 새로운 \`sortOrder\`가 됩니다.

\`\`\`json
// 기존: [항목A(id:1), 항목B(id:2), 항목C(id:3)]
// 항목C를 맨 위로 이동:
{ "itemIds": [3, 1, 2] }
// 결과: [항목C(sortOrder:0), 항목A(sortOrder:1), 항목B(sortOrder:2)]
\`\`\`

**주의사항**
- \`itemIds\`에는 해당 투두의 **전체** 하위 항목 ID를 새로운 순서대로 포함해야 합니다
- 일부 ID만 전달하면 sortOrder 충돌이 발생하므로 \`400 Bad Request\` 에러 반환
- 존재하지 않거나 다른 투두의 ID가 포함되면 TODO_0822 에러 반환`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0822])
  async reorderItems(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoIdParamDto }) params: TodoIdParamDto,
    @Body({ schema: ReorderTodoItemsDto }) dto: ReorderTodoItemsDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#reorderTodoItemsUseCase.execute({
      todoId: params.id,
      userId: user.userId,
      itemIds: dto.itemIds,
    });

    return {
      message: "하위 항목 순서가 변경되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Patch(":id/items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "하위 항목 수정",
    operationId: "updateTodoItem",
    description: `하위 항목의 제목 또는 완료 상태를 수정합니다.

**요청 필드** (최소 1개 필수)
- \`title\` (선택): 변경할 제목 (1-200자)
- \`completed\` (선택): 완료 상태 (true/false)

**완료 토글 사용법**
\`\`\`json
{ "completed": true }   // 체크
{ "completed": false }  // 체크 해제
\`\`\`

**부모 할 일과의 관계**
- 하위 항목의 완료/미완료는 부모 할 일의 \`completed\` 상태에 **영향을 주지 않습니다**
- 모든 하위 항목이 완료(예: 3/3)되어도 부모는 **자동 완료되지 않습니다**
- 부모 할 일의 완료는 \`PATCH /todos/:id/complete\` API를 별도로 호출해야 합니다
- 하위 항목 완료는 스트릭/마일스톤/일일 완료 알림에 **영향을 주지 않습니다** (부모만 카운트)

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 없음 | TODO_0822 | 404 |
| 유효성 검증 실패 | SYS_0002 | 400 |`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0822])
  async updateItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoItemIdParamDto }) params: TodoItemIdParamDto,
    @Body({ schema: UpdateTodoItemDto }) dto: UpdateTodoItemDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#updateTodoItemUseCase.execute({
      todoId: params.id,
      itemId: params.itemId,
      userId: user.userId,
      data: {
        title: dto.title,
        completed: dto.completed,
      },
    });

    return {
      message: "하위 항목이 수정되었습니다.",
      todo: toTodoResponse(todo),
    };
  }

  @Delete(":id/items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "하위 항목 삭제",
    operationId: "deleteTodoItem",
    description: `하위 항목을 삭제합니다. 삭제 후 복구할 수 없습니다.

**응답**
- 부모 할 일 전체 객체를 반환합니다 (삭제된 항목이 제외된 상태)
- \`itemStats\`가 자동으로 재계산됩니다

**참고**
- 부모 할 일 자체를 삭제하면(\`DELETE /todos/:id\`) 모든 하위 항목이 함께 삭제됩니다 (Cascade)
- 개별 하위 항목 삭제는 이 API를 사용하세요

**에러**

| 상황 | 코드 | HTTP |
|------|------|------|
| 인증 실패 | AUTH_0107 | 401 |
| 할 일 없음 | TODO_0801 | 404 |
| 하위 항목 없음 | TODO_0822 | 404 |`,
  })
  @ApiSuccessResponse({ type: UpdateTodoResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0822])
  async deleteItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoItemIdParamDto }) params: TodoItemIdParamDto,
  ): Promise<UpdateTodoResponseDto> {
    const todo = await this.#deleteTodoItemUseCase.execute({
      todoId: params.id,
      itemId: params.itemId,
      userId: user.userId,
    });

    return {
      message: "하위 항목이 삭제되었습니다.",
      todo: toTodoResponse(todo),
    };
  }
}
