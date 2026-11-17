import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, HttpCode, HttpStatus, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { ChangeTodoCategoryUseCase } from "../../../application/use-cases/change-todo-category.use-case.js";
import { ReorderTodoUseCase } from "../../../application/use-cases/reorder-todo.use-case.js";
import { SetTodoCompletedUseCase } from "../../../application/use-cases/set-todo-completed.use-case.js";
import { UpdateTodoScheduleUseCase } from "../../../application/use-cases/update-todo-schedule.use-case.js";
import { UpdateTodoTitleUseCase } from "../../../application/use-cases/update-todo-title.use-case.js";
import { UpdateTodoVisibilityUseCase } from "../../../application/use-cases/update-todo-visibility.use-case.js";
import { toTodoResponse } from "./todo-response.mapper.js";
import {
  ChangeTodoCategoryDto,
  ReorderTodoDto,
  ReorderTodoResponseDto,
  TodoIdParamDto,
  ToggleTodoCompleteDto,
  UpdateTodoResponseDto,
  UpdateTodoScheduleDto,
  UpdateTodoTitleDto,
  UpdateTodoVisibilityDto,
} from "./todo.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller({ path: "todos", version: API_VERSION.V1 })
export class TodoFieldController {
  readonly #toggleTodoCompleteUseCase: SetTodoCompletedUseCase;
  readonly #updateTodoVisibilityUseCase: UpdateTodoVisibilityUseCase;
  readonly #changeTodoCategoryUseCase: ChangeTodoCategoryUseCase;
  readonly #updateTodoScheduleUseCase: UpdateTodoScheduleUseCase;
  readonly #updateTodoTitleUseCase: UpdateTodoTitleUseCase;
  readonly #reorderTodoUseCase: ReorderTodoUseCase;

  constructor(
    toggleTodoCompleteUseCase: SetTodoCompletedUseCase,
    updateTodoVisibilityUseCase: UpdateTodoVisibilityUseCase,
    changeTodoCategoryUseCase: ChangeTodoCategoryUseCase,
    updateTodoScheduleUseCase: UpdateTodoScheduleUseCase,
    updateTodoTitleUseCase: UpdateTodoTitleUseCase,
    reorderTodoUseCase: ReorderTodoUseCase,
  ) {
    this.#toggleTodoCompleteUseCase = toggleTodoCompleteUseCase;
    this.#updateTodoVisibilityUseCase = updateTodoVisibilityUseCase;
    this.#changeTodoCategoryUseCase = changeTodoCategoryUseCase;
    this.#updateTodoScheduleUseCase = updateTodoScheduleUseCase;
    this.#updateTodoTitleUseCase = updateTodoTitleUseCase;
    this.#reorderTodoUseCase = reorderTodoUseCase;
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
}
