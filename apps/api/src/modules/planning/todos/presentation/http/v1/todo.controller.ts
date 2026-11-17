import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { toTodoSeriesResponse } from "#api/modules/planning/todo-series/planning-todo-series.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
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
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { createdTodoMissing, recurringTodoHasNoDates } from "../../../application/todos.errors.js";
import { CreateTodoUseCase } from "../../../application/use-cases/create-todo.use-case.js";
import { DeleteTodoUseCase } from "../../../application/use-cases/delete-todo.use-case.js";
import { EditTodoUseCase } from "../../../application/use-cases/edit-todo.use-case.js";
import { toTodoResponse } from "./todo-response.mapper.js";
import {
  CreateRecurringTodoDto,
  CreateRecurringTodoResponseDto,
  CreateTodoDto,
  CreateTodoResponseDto,
  DeleteTodoQueryDto,
  DeleteTodoResponseDto,
  TodoIdParamDto,
  UpdateTodoDto,
  UpdateTodoResponseDto,
} from "./todo.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller({ path: "todos", version: API_VERSION.V1 })
export class TodoController {
  readonly #createTodoUseCase: CreateTodoUseCase;
  readonly #editTodoUseCase: EditTodoUseCase;
  readonly #deleteTodoUseCase: DeleteTodoUseCase;

  constructor(
    createTodoUseCase: CreateTodoUseCase,
    editTodoUseCase: EditTodoUseCase,
    deleteTodoUseCase: DeleteTodoUseCase,
  ) {
    this.#createTodoUseCase = createTodoUseCase;
    this.#editTodoUseCase = editTodoUseCase;
    this.#deleteTodoUseCase = deleteTodoUseCase;
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
  @ApiCreatedSuccessResponse({ type: CreateTodoResponseDto })
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
      throw createdTodoMissing();
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
  @ApiCreatedSuccessResponse({ type: CreateRecurringTodoResponseDto })
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
          throw recurringTodoHasNoDates(dto.startDate, dto.endDate, dto.daysOfWeek);
        }
        throw error;
      });

    return {
      message: `반복 할 일이 ${todos.length}개 생성되었습니다.`,
      todos: todos.map(toTodoResponse),
      count: todos.length,
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
}
