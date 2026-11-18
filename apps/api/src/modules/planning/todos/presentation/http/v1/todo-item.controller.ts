import { ErrorCode } from "@aido/api/errors";
import { TODO_ITEM_LIMITS } from "@aido/api/vocabulary";
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
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

import { AddTodoItemUseCase } from "../../../application/use-cases/add-todo-item.use-case.js";
import { DeleteTodoItemUseCase } from "../../../application/use-cases/delete-todo-item.use-case.js";
import { ReorderTodoItemsUseCase } from "../../../application/use-cases/reorder-todo-items.use-case.js";
import { UpdateTodoItemUseCase } from "../../../application/use-cases/update-todo-item.use-case.js";
import { toTodoResponse } from "./todo-response.mapper.js";
import {
  CreateTodoItemDto,
  ReorderTodoItemsDto,
  TodoIdParamDto,
  TodoItemIdParamDto,
  UpdateTodoItemDto,
  UpdateTodoResponseDto,
} from "./todo.dto.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller({ path: "todos", version: API_VERSION.V1 })
export class TodoItemController {
  readonly #addTodoItemUseCase: AddTodoItemUseCase;
  readonly #reorderTodoItemsUseCase: ReorderTodoItemsUseCase;
  readonly #updateTodoItemUseCase: UpdateTodoItemUseCase;
  readonly #deleteTodoItemUseCase: DeleteTodoItemUseCase;

  constructor(
    addTodoItemUseCase: AddTodoItemUseCase,
    reorderTodoItemsUseCase: ReorderTodoItemsUseCase,
    updateTodoItemUseCase: UpdateTodoItemUseCase,
    deleteTodoItemUseCase: DeleteTodoItemUseCase,
  ) {
    this.#addTodoItemUseCase = addTodoItemUseCase;
    this.#reorderTodoItemsUseCase = reorderTodoItemsUseCase;
    this.#updateTodoItemUseCase = updateTodoItemUseCase;
    this.#deleteTodoItemUseCase = deleteTodoItemUseCase;
  }

  // 하위 항목 (체크리스트) 관리
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
  @ApiCreatedSuccessResponse({ type: UpdateTodoResponseDto })
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
