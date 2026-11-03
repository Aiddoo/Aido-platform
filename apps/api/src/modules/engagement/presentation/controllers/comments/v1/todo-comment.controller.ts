import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Headers,
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
import { ApiHeader, ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiConflictError,
  ApiCreatedResponse,
  ApiDoc,
  ApiErrorCodesResponse,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { THROTTLED_DESCRIPTION, ThrottleByUser } from "#api/platform/throttle/index";

import { TODO_COMMENT_PAGE_DIRECTION } from "../../../../application/models/comments/todo-comment.types.js";
import { toTodoCommentOverviewResponse } from "../../../../application/presenters/comments/v1/index.js";
import { DeleteTodoComment } from "../../../../application/use-cases/comments/delete-todo-comment.use-case.js";
import {
  GetTodoCommentThreads,
  type GetTodoCommentThreadsPage,
} from "../../../../application/use-cases/comments/get-todo-comment-threads.use-case.js";
import { GetTodoConversation } from "../../../../application/use-cases/comments/get-todo-conversation.use-case.js";
import { GetTodoDetails } from "../../../../application/use-cases/comments/get-todo-details.use-case.js";
import { LikeTodoComment } from "../../../../application/use-cases/comments/like-todo-comment.use-case.js";
import { UnlikeTodoComment } from "../../../../application/use-cases/comments/unlike-todo-comment.use-case.js";
import { UpdateTodoComment } from "../../../../application/use-cases/comments/update-todo-comment.use-case.js";
import { WriteTodoCommentChain } from "../../../../application/use-cases/comments/write-todo-comment-chain.use-case.js";
import { TodoCommentMapper } from "../../../mappers/comments/v1/todo-comment.mapper.js";
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
} from "../../../schemas/comments/v1/index.js";

/** 사용자마다 1분 창. 이어 쓰기 한 요청이 최대 5개라 작성은 글 수가 아니라 요청 수로 센다. */
export const TODO_COMMENT_THROTTLE = {
  WRITE: { default: { ttl: 60_000, limit: 30 } },
  LIKE: { default: { ttl: 60_000, limit: 120 } },
} as const;

const DEPRECATED_READ_DESCRIPTION =
  "1.14.0 이하 앱 전용입니다. 1.14.1 이상은 `GET /v2/todos/{todoId}/comments`와 `…/comments/{commentId}/replies`를 씁니다. 댓글·답글 2단계 값만 내려갑니다.";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller("todos/:todoId")
export class TodoCommentController {
  constructor(
    private readonly getTodoDetails: GetTodoDetails,
    private readonly getTodoCommentThreads: GetTodoCommentThreads,
    private readonly getTodoConversation: GetTodoConversation,
    private readonly writeTodoCommentChain: WriteTodoCommentChain,
    private readonly updateTodoComment: UpdateTodoComment,
    private readonly deleteTodoComment: DeleteTodoComment,
    private readonly likeTodoComment: LikeTodoComment,
    private readonly unlikeTodoComment: UnlikeTodoComment,
  ) {}

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("details")
  @ApiDoc({ summary: "댓글 화면용 할 일 상세 조회", operationId: "getTodoDetails" })
  @ApiSuccessResponse({ type: TodoDetailsResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async getDetails(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoDetailsResponseDto> {
    const result = await this.getTodoDetails.execute({
      todoId: params.todoId,
      viewerId: user.userId,
    });
    return TodoCommentMapper.toDetails(result, appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("comments/overview")
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

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentOverviewResponseDto> {
    const result = await this.getTodoCommentThreads.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      page: toOverviewPage(query),
    });
    return TodoCommentMapper.toOverview(toTodoCommentOverviewResponse(result), appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("conversation")
  @ApiDoc({
    summary: "할 일 댓글 대화 조회",
    operationId: "getTodoConversation",
    deprecated: true,
    description: DEPRECATED_READ_DESCRIPTION,
  })
  @ApiSuccessResponse({ type: TodoConversationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoConversationQueryDto }) query: GetTodoConversationQueryDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoConversationResponseDto> {
    const result = await this.getTodoConversation.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      focusCommentId: query.focusCommentId,
      before: query.before,
      after: query.after,
    });
    return TodoCommentMapper.toConversation(result, appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Post("comments")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.WRITE)
  @ApiDoc({
    summary: "할 일 댓글 작성 (한 번에 이어 쓰기 가능)",
    operationId: "createTodoComment",
    description:
      "parentId가 없으면 새 댓글, 있으면 그 글이 속한 묶음 끝에 답글로 붙습니다(답글에 답해도 2단계). 이어 쓴 글은 같은 묶음에 각자 앞 글에 답하며 붙습니다. 사용자마다 분당 30회까지입니다.",
  })
  @ApiCreatedResponse({ type: TodoCommentChainResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.BLOCK_2204)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async writeComments(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Body({ schema: WriteTodoCommentChainDto }) body: WriteTodoCommentChainDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentChainResponseDto> {
    const result = await this.writeTodoCommentChain.execute({
      todoId: params.todoId,
      authorId: user.userId,
      parentId: body.parentId,
      items: body.items,
    });
    return TodoCommentMapper.toChain(result, appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Patch("comments/:commentId")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.WRITE)
  @ApiDoc({ summary: "본인 댓글 수정", operationId: "updateTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentMutationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.TODO_0832)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async updateComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
    @Body({ schema: UpdateTodoCommentDto }) body: UpdateTodoCommentDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentMutationResponseDto> {
    const result = await this.updateTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
      content: body.content,
    });
    return TodoCommentMapper.toMutation(result, appVersion);
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
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  deleteComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<DeleteTodoCommentResponseDto> {
    return this.deleteTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }

  @Put("comments/:commentId/likes")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.LIKE)
  @ApiDoc({ summary: "댓글 좋아요", operationId: "likeTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.BLOCK_2204)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  likeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    return this.likeTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }

  @Delete("comments/:commentId/likes")
  @ThrottleByUser()
  @Throttle(TODO_COMMENT_THROTTLE.LIKE)
  @ApiDoc({ summary: "댓글 좋아요 취소", operationId: "unlikeTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.NOT_FOUND, [ErrorCode.TODO_0801, ErrorCode.TODO_0831])
  @ApiConflictError(ErrorCode.TODO_0833)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  unlikeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    return this.unlikeTodoComment.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }
}

function toOverviewPage(query: GetTodoCommentOverviewQueryDto): GetTodoCommentThreadsPage {
  if (query.before != null) {
    return { kind: "CURSOR", cursor: query.before, direction: TODO_COMMENT_PAGE_DIRECTION.BEFORE };
  }

  if (query.after != null) {
    return { kind: "CURSOR", cursor: query.after, direction: TODO_COMMENT_PAGE_DIRECTION.AFTER };
  }

  return { kind: "FIRST" };
}
