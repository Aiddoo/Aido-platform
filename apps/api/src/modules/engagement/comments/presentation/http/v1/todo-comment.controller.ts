import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedSuccessResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { DeleteTodoCommentUseCase } from "../../../application/use-cases/delete-todo-comment.use-case.js";
import { GetTodoConversationUseCase } from "../../../application/use-cases/get-todo-conversation.use-case.js";
import { GetTodoDetailsUseCase } from "../../../application/use-cases/get-todo-details.use-case.js";
import { LikeTodoCommentUseCase } from "../../../application/use-cases/like-todo-comment.use-case.js";
import {
  ListTodoCommentThreadsUseCase,
  type TodoCommentThreadsPageRequest,
} from "../../../application/use-cases/list-todo-comment-threads.use-case.js";
import { UnlikeTodoCommentUseCase } from "../../../application/use-cases/unlike-todo-comment.use-case.js";
import { UpdateTodoCommentUseCase } from "../../../application/use-cases/update-todo-comment.use-case.js";
import { WriteTodoCommentChainUseCase } from "../../../application/use-cases/write-todo-comment-chain.use-case.js";
import {
  toTodoCommentChainResponse,
  toTodoCommentLikeResponse,
  toTodoCommentMutationResponse,
  toTodoCommentOverviewResponse,
  toTodoConversationResponse,
  toTodoDetailsResponse,
} from "./todo-comment-response.mapper.js";
import {
  DeleteTodoCommentResponseDto,
  GetTodoCommentOverviewQueryDto,
  GetTodoConversationQueryDto,
  TodoCommentIdParamDto,
  TodoCommentChainResponseDto,
  TodoCommentLikeResponseDto,
  TodoCommentMutationResponseDto,
  TodoCommentOverviewResponseDto,
  TodoConversationResponseDto,
  TodoDetailsParamDto,
  TodoDetailsResponseDto,
  UpdateTodoCommentDto,
  WriteTodoCommentChainDto,
} from "./todo-comment.dto.js";

/** 사용자마다 1분 창. 이어 쓰기 한 요청이 최대 5개라 작성은 글 수가 아니라 요청 수로 센다. */
export const TODO_COMMENT_THROTTLE = {
  WRITE: { default: { ttl: 60_000, limit: 30 } },
  LIKE: { default: { ttl: 60_000, limit: 120 } },
} as const;

const DEPRECATED_READ_DESCRIPTION =
  "1.14.0 이하 앱 전용입니다. 1.14.1 이상은 `GET /v2/todos/{todoId}/comments`와 `…/comments/{commentId}/replies`를 씁니다. 댓글·답글 2단계 값만 내려갑니다. 1.14.0 이하 앱 사용자가 사라지면 제거합니다.";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller({ path: "todos/:todoId", version: API_VERSION.V1 })
export class TodoCommentController {
  readonly #getTodoDetails: GetTodoDetailsUseCase;
  readonly #getTodoCommentThreads: ListTodoCommentThreadsUseCase;
  readonly #getTodoConversation: GetTodoConversationUseCase;
  readonly #writeTodoCommentChain: WriteTodoCommentChainUseCase;
  readonly #updateTodoComment: UpdateTodoCommentUseCase;
  readonly #deleteTodoComment: DeleteTodoCommentUseCase;
  readonly #likeTodoComment: LikeTodoCommentUseCase;
  readonly #unlikeTodoComment: UnlikeTodoCommentUseCase;

  constructor(
    getTodoDetails: GetTodoDetailsUseCase,
    getTodoCommentThreads: ListTodoCommentThreadsUseCase,
    getTodoConversation: GetTodoConversationUseCase,
    writeTodoCommentChain: WriteTodoCommentChainUseCase,
    updateTodoComment: UpdateTodoCommentUseCase,
    deleteTodoComment: DeleteTodoCommentUseCase,
    likeTodoComment: LikeTodoCommentUseCase,
    unlikeTodoComment: UnlikeTodoCommentUseCase,
  ) {
    this.#getTodoDetails = getTodoDetails;
    this.#getTodoCommentThreads = getTodoCommentThreads;
    this.#getTodoConversation = getTodoConversation;
    this.#writeTodoCommentChain = writeTodoCommentChain;
    this.#updateTodoComment = updateTodoComment;
    this.#deleteTodoComment = deleteTodoComment;
    this.#likeTodoComment = likeTodoComment;
    this.#unlikeTodoComment = unlikeTodoComment;
  }

  @Get("details")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "댓글 화면용 할 일 상세 조회",
    operationId: "getTodoDetails",
    description:
      "댓글 화면에 필요한 할 일, 주인, 내 권한과 조회수를 돌려줍니다. 할 일 주인이 아닌 사용자가 열면 조회수를 올립니다.",
  })
  @ApiSuccessResponse({ type: TodoDetailsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async getDetails(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,

    @AppVersion() appVersion?: string,
  ): Promise<TodoDetailsResponseDto> {
    const result = await this.#getTodoDetails.execute({
      todoId: params.todoId,
      viewerId: user.userId,
    });
    return toTodoDetailsResponse(result, appVersion);
  }

  @Get("comments/overview")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "할 일 댓글 개요 조회",
    operationId: "getTodoCommentOverview",
    deprecated: true,
    description: DEPRECATED_READ_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: TodoCommentOverviewResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async getOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoCommentOverviewQueryDto }) query: GetTodoCommentOverviewQueryDto,

    @AppVersion() appVersion?: string,
  ): Promise<TodoCommentOverviewResponseDto> {
    const result = await this.#getTodoCommentThreads.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      page: toOverviewPage(query),
    });
    return toTodoCommentOverviewResponse(result, appVersion);
  }

  @Get("conversation")
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "할 일 댓글 대화 조회",
    operationId: "getTodoConversation",
    deprecated: true,
    description: DEPRECATED_READ_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: TodoConversationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoConversationQueryDto }) query: GetTodoConversationQueryDto,

    @AppVersion() appVersion?: string,
  ): Promise<TodoConversationResponseDto> {
    const result = await this.#getTodoConversation.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      focusCommentId: query.focusCommentId,
      before: query.before,
      after: query.after,
    });
    return toTodoConversationResponse(result, appVersion);
  }

  @Post("comments")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.WRITE)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "할 일 댓글 작성 (한 번에 이어 쓰기 가능)",
    operationId: "createTodoComment",
    description:
      "parentId가 없으면 새 댓글, 있으면 그 글이 속한 묶음 끝에 답글로 붙습니다(답글에 답해도 2단계). 이어 쓴 글은 같은 묶음에 각자 앞 글에 답하며 붙습니다. 사용자마다 분당 30회까지입니다.",
  })
  @ApiCreatedSuccessResponse({ type: TodoCommentChainResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.BLOCK_2204)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [ErrorCode.TODO_0833, ErrorCode.SYS_0003])
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async writeComments(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Body({ schema: WriteTodoCommentChainDto }) body: WriteTodoCommentChainDto,

    @AppVersion() appVersion?: string,
  ): Promise<TodoCommentChainResponseDto> {
    const result = await this.#writeTodoCommentChain.execute({
      todoId: params.todoId,
      authorId: user.userId,
      parentId: body.parentId,
      items: body.items,
    });
    return toTodoCommentChainResponse(result, appVersion);
  }

  @Patch("comments/:commentId")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.WRITE)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "본인 댓글 수정",
    operationId: "updateTodoComment",
    description:
      "본인이 쓴 댓글의 내용을 고칩니다. 삭제된 댓글은 고칠 수 없습니다. 사용자마다 분당 30회까지입니다.",
  })
  @ApiSuccessResponse({ type: TodoCommentMutationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.TODO_0832)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [ErrorCode.TODO_0833, ErrorCode.SYS_0003])
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async updateComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
    @Body({ schema: UpdateTodoCommentDto }) body: UpdateTodoCommentDto,

    @AppVersion() appVersion?: string,
  ): Promise<TodoCommentMutationResponseDto> {
    const result = await this.#updateTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
      content: body.content,
    });
    return toTodoCommentMutationResponse(result, appVersion);
  }

  @Delete("comments/:commentId")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.WRITE)
  @ApiDoc({
    summary: "댓글 삭제",
    operationId: "deleteTodoComment",
    description:
      "작성자는 자기 댓글을, 할 일 주인은 자기 할 일에 달린 모든 댓글을 삭제할 수 있습니다. 답글이 남은 댓글은 모든 사람에게 삭제된 댓글로 남고, 지운 답글과 답글이 없는 댓글은 목록에서 빠집니다. 같은 글을 다시 지워도 성공합니다.",
  })
  @ApiSuccessResponse({ type: DeleteTodoCommentResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.TODO_0832)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.SYS_0003)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async deleteComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<DeleteTodoCommentResponseDto> {
    await this.#deleteTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
    return { commentId: params.commentId, isDeleted: true };
  }

  @Put("comments/:commentId/likes")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.LIKE)
  @ApiDoc({
    summary: "댓글 좋아요",
    operationId: "likeTodoComment",
    description:
      "댓글에 좋아요를 누릅니다. 이미 눌렀어도 성공하고 좋아요 수는 늘지 않습니다. 차단 관계인 사용자의 댓글에는 누를 수 없습니다. 사용자마다 분당 120회까지입니다.",
  })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.BLOCK_2204)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async likeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    const result = await this.#likeTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
    return toTodoCommentLikeResponse(result);
  }

  @Delete("comments/:commentId/likes")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.LIKE)
  @ApiDoc({
    summary: "댓글 좋아요 취소",
    operationId: "unlikeTodoComment",
    description:
      "누른 좋아요를 취소합니다. 누르지 않은 댓글도 성공합니다. 사용자마다 분당 120회까지입니다.",
  })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async unlikeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    const result = await this.#unlikeTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
    return toTodoCommentLikeResponse(result);
  }
}

function toOverviewPage(query: GetTodoCommentOverviewQueryDto): TodoCommentThreadsPageRequest {
  if (query.before != null) {
    return { kind: "CURSOR", cursor: query.before, direction: "BEFORE" };
  }

  if (query.after != null) {
    return { kind: "CURSOR", cursor: query.after, direction: "AFTER" };
  }

  return { kind: "FIRST" };
}
