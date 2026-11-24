import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, TODO_IMPORT_LIMITS } from "@aido/api/vocabulary";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { IdempotencyKey } from "#api/platform/http/decorators/idempotency-key.decorator";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiNotFoundError,
  ApiUnauthorizedError,
  ApiUnprocessableError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiIdempotencyKeyHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { CancelTodoImportUseCase } from "../../../application/use-cases/cancel-todo-import.use-case.js";
import { CommitTodoImportUseCase } from "../../../application/use-cases/commit-todo-import.use-case.js";
import { FindActiveTodoImportUseCase } from "../../../application/use-cases/find-active-todo-import.use-case.js";
import { GetTodoImportUseCase } from "../../../application/use-cases/get-todo-import.use-case.js";
import { ReceiveTodoImportItemsUseCase } from "../../../application/use-cases/receive-todo-import-items.use-case.js";
import { RequestTodoImportUndoUseCase } from "../../../application/use-cases/request-todo-import-undo.use-case.js";
import { StartTodoImportUseCase } from "../../../application/use-cases/start-todo-import.use-case.js";
import { TodoImportRateLimits } from "../todo-imports.rate-limits.js";
import { toStartTodoImportCommand, toTodoImportItems } from "./todo-import-command.mapper.js";
import {
  toActiveTodoImportResponse,
  toReceiveTodoImportItemsResponse,
  toTodoImportResponse,
} from "./todo-import-response.mapper.js";
import {
  ActiveTodoImportResponseDto,
  ReceiveTodoImportItemsDto,
  ReceiveTodoImportItemsResponseDto,
  StartTodoImportDto,
  TodoImportIdParamDto,
  TodoImportResponseDto,
} from "./todo-import.dto.js";

interface TodoImportUseCases {
  readonly start: StartTodoImportUseCase;
  readonly receiveItems: ReceiveTodoImportItemsUseCase;
  readonly commit: CommitTodoImportUseCase;
  readonly get: GetTodoImportUseCase;
  readonly findActive: FindActiveTodoImportUseCase;
  readonly cancel: CancelTodoImportUseCase;
  readonly requestUndo: RequestTodoImportUndoUseCase;
}

@ApiTags(SWAGGER_TAGS.TODO_IMPORTS)
@ApiBearerAuth()
@Controller({ path: "todo-imports", version: API_VERSION.V1 })
export class TodoImportController {
  readonly #useCases: TodoImportUseCases;

  constructor(
    start: StartTodoImportUseCase,
    receiveItems: ReceiveTodoImportItemsUseCase,
    commit: CommitTodoImportUseCase,
    get: GetTodoImportUseCase,
    findActive: FindActiveTodoImportUseCase,
    cancel: CancelTodoImportUseCase,
    requestUndo: RequestTodoImportUndoUseCase,
  ) {
    this.#useCases = { start, receiveItems, commit, get, findActive, cancel, requestUndo };
  }

  @Post()
  @RateLimit(TodoImportRateLimits.start)
  @ApiIdempotencyKeyHeader()
  @ApiDoc({
    summary: "캘린더 가져오기 시작",
    operationId: "startTodoImport",
    description: `가져올 기간·대상 카테고리·캘린더를 정하고 업로드를 엽니다. 날짜·시각은 \`X-Timezone\`(없으면 저장된 시간대, 그것도 없으면 Asia/Seoul) 하나로 해석하고 응답 \`todoImport.timezone\`으로 돌려줍니다. 이어 보내기와 할 일 만들기는 모두 이 시간대를 씁니다.

## 🚫 기간
오늘부터 무료 ${PLAN_CATALOG.CALENDAR_IMPORT.free}일, 프리미엄 ${PLAN_CATALOG.CALENDAR_IMPORT.premium}일까지입니다. 넘으면 TODO_IMPORT_2302(\`featureQuota\`)입니다.

## 🔁 재시도
같은 \`Idempotency-Key\`로 같은 본문을 다시 보내면 처음 가져오기를 돌려주고, 본문이 다르면 TODO_IMPORT_2307입니다.`,
  })
  @ApiCreatedSuccessResponse({ type: TodoImportResponseDto })
  @ApiBadRequestError(ErrorCode.TODO_IMPORT_2306)
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [
    ErrorCode.TODO_IMPORT_2302,
    ErrorCode.TODO_CATEGORY_0857,
  ])
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [
    ErrorCode.TODO_IMPORT_2301,
    ErrorCode.TODO_IMPORT_2303,
  ])
  @ApiUnprocessableError(ErrorCode.TODO_IMPORT_2307)
  async start(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: StartTodoImportDto }) dto: StartTodoImportDto,
    @IdempotencyKey() idempotencyKey: string,
    @Timezone({ preserveIfMissing: true }) requestedTimezone: string | undefined,
  ): Promise<TodoImportResponseDto> {
    const started = await this.#useCases.start.execute(
      toStartTodoImportCommand({ userId: user.userId, idempotencyKey, requestedTimezone, dto }),
    );
    return toTodoImportResponse(started);
  }

  @Get("active")
  @RateLimit(TodoImportRateLimits.findActive)
  @ApiDoc({
    summary: "진행 중 가져오기",
    operationId: "getActiveTodoImport",
    description:
      "업로드·대기·만들기·되돌리기 중인 가져오기입니다. 없으면 `todoImport`가 null입니다.",
  })
  @ApiSuccessResponse({ type: ActiveTodoImportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async findActive(@CurrentUser() user: CurrentUserPayload): Promise<ActiveTodoImportResponseDto> {
    const active = await this.#useCases.findActive.execute({ userId: user.userId });
    return toActiveTodoImportResponse(active);
  }

  @Post(":importId/items")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TodoImportRateLimits.receiveItems)
  @ApiDoc({
    summary: "가져올 일정 올리기",
    operationId: "receiveTodoImportItems",
    description: `일정을 ${TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK}개까지 한 묶음으로 올립니다. 이미 받은 \`sourceKey\`는 무시하므로 끊긴 업로드를 처음부터 다시 보내도 됩니다. 가져오기 하나에 ${TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT}개를 넘으면 TODO_IMPORT_2309입니다.`,
  })
  @ApiSuccessResponse({ type: ReceiveTodoImportItemsResponseDto })
  @ApiBadRequestError(ErrorCode.TODO_IMPORT_2306)
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_IMPORT_2304)
  @ApiConflictError(ErrorCode.TODO_IMPORT_2305)
  @ApiUnprocessableError(ErrorCode.TODO_IMPORT_2309)
  async receiveItems(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoImportIdParamDto }) params: TodoImportIdParamDto,
    @Body({ schema: ReceiveTodoImportItemsDto }) dto: ReceiveTodoImportItemsDto,
  ): Promise<ReceiveTodoImportItemsResponseDto> {
    const received = await this.#useCases.receiveItems.execute({
      userId: user.userId,
      importId: params.importId,
      items: toTodoImportItems(dto),
    });
    return toReceiveTodoImportItemsResponse(received);
  }

  @Post(":importId/commit")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TodoImportRateLimits.commit)
  @ApiDoc({
    summary: "가져오기 확정",
    operationId: "commitTodoImport",
    description:
      "업로드를 끝내고 서버 작업이 할 일을 만들기 시작합니다. 새 카테고리를 이때 만듭니다. 이미 확정했으면 지금 상태를 돌려줍니다.",
  })
  @ApiSuccessResponse({ type: TodoImportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.FORBIDDEN, [
    ErrorCode.TODO_IMPORT_2302,
    ErrorCode.TODO_CATEGORY_0857,
  ])
  @ApiNotFoundError(ErrorCode.TODO_IMPORT_2304)
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [
    ErrorCode.TODO_IMPORT_2303,
    ErrorCode.TODO_IMPORT_2305,
  ])
  async commit(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoImportIdParamDto }) params: TodoImportIdParamDto,
  ): Promise<TodoImportResponseDto> {
    const committed = await this.#useCases.commit.execute({
      userId: user.userId,
      importId: params.importId,
    });
    return toTodoImportResponse(committed);
  }

  @Get(":importId")
  @RateLimit(TodoImportRateLimits.get)
  @ApiDoc({
    summary: "가져오기 진행·결과",
    operationId: "getTodoImport",
    description: "상태·센 수와 서버가 정한 되돌리기 마감(`undoableUntil`)을 돌려줍니다.",
  })
  @ApiSuccessResponse({ type: TodoImportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_IMPORT_2304)
  async get(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoImportIdParamDto }) params: TodoImportIdParamDto,
  ): Promise<TodoImportResponseDto> {
    const found = await this.#useCases.get.execute({
      userId: user.userId,
      importId: params.importId,
    });
    return toTodoImportResponse(found);
  }

  @Delete(":importId")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TodoImportRateLimits.cancel)
  @ApiDoc({
    summary: "가져오기 취소",
    operationId: "cancelTodoImport",
    description: "확정 전(업로드 중)에만 취소하고 올린 일정을 지웁니다.",
  })
  @ApiSuccessResponse({ type: TodoImportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_IMPORT_2304)
  @ApiConflictError(ErrorCode.TODO_IMPORT_2305)
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoImportIdParamDto }) params: TodoImportIdParamDto,
  ): Promise<TodoImportResponseDto> {
    const canceled = await this.#useCases.cancel.execute({
      userId: user.userId,
      importId: params.importId,
    });
    return toTodoImportResponse(canceled);
  }

  @Post(":importId/undo")
  @HttpCode(HttpStatus.OK)
  @RateLimit(TodoImportRateLimits.requestUndo)
  @ApiDoc({
    summary: "가져오기 되돌리기",
    operationId: "undoTodoImport",
    description: `완료 뒤 ${TODO_IMPORT_LIMITS.UNDO_WINDOW_DAYS}일 안에 가져온 할 일 중 완료하지 않은 것을 서버 작업이 지웁니다. 완료한 할 일과 새로 만든 카테고리는 남깁니다.`,
  })
  @ApiSuccessResponse({ type: TodoImportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_IMPORT_2304)
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [
    ErrorCode.TODO_IMPORT_2305,
    ErrorCode.TODO_IMPORT_2308,
  ])
  async requestUndo(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoImportIdParamDto }) params: TodoImportIdParamDto,
  ): Promise<TodoImportResponseDto> {
    const undoing = await this.#useCases.requestUndo.execute({
      userId: user.userId,
      importId: params.importId,
    });
    return toTodoImportResponse(undoing);
  }
}
