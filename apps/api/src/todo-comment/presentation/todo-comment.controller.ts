import { ErrorCode } from "@aido/api/errors";
import {
  Header,
  Headers,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiHeader, ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser, type CurrentUserPayload } from "#api/auth/presentation/decorators/index";
import {
  ApiBadRequestError,
  ApiCreatedResponse,
  ApiDoc,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/shared/presentation/swagger/index";

import {
  GetTodoCommentOverviewUseCase,
  GetTodoConversationUseCase,
  GetTodoDetailsUseCase,
} from "../application/queries/index.js";
import {
  DeleteTodoCommentUseCase,
  LikeTodoCommentUseCase,
  UnlikeTodoCommentUseCase,
  UpdateTodoCommentUseCase,
  WriteTodoCommentChainUseCase,
} from "../application/use-cases/index.js";
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
} from "./dtos/index.js";
import { TodoCommentMapper } from "./todo-comment.mapper.js";

@ApiTags(SWAGGER_TAGS.TODOS)
@ApiBearerAuth()
@Controller("todos/:todoId")
export class TodoCommentController {
  constructor(
    private readonly getTodoDetailsUseCase: GetTodoDetailsUseCase,
    private readonly getTodoCommentOverviewUseCase: GetTodoCommentOverviewUseCase,
    private readonly getTodoConversationUseCase: GetTodoConversationUseCase,
    private readonly writeTodoCommentChainUseCase: WriteTodoCommentChainUseCase,
    private readonly updateTodoCommentUseCase: UpdateTodoCommentUseCase,
    private readonly deleteTodoCommentUseCase: DeleteTodoCommentUseCase,
    private readonly likeTodoCommentUseCase: LikeTodoCommentUseCase,
    private readonly unlikeTodoCommentUseCase: UnlikeTodoCommentUseCase,
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
    const result = await this.getTodoDetailsUseCase.execute({
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
  @ApiDoc({ summary: "할 일 댓글 개요 조회", operationId: "getTodoCommentOverview" })
  @ApiSuccessResponse({ type: TodoCommentOverviewResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  @ApiBadRequestError(ErrorCode.SYS_0002)
  async getOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoCommentOverviewQueryDto }) query: GetTodoCommentOverviewQueryDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentOverviewResponseDto> {
    const result = await this.getTodoCommentOverviewUseCase.execute({
      todoId: params.todoId,
      viewerId: user.userId,
      sort: query.sort,
      size: query.size,
      before: query.before,
      after: query.after,
    });
    return TodoCommentMapper.toOverview(result, appVersion);
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get("conversation")
  @ApiDoc({ summary: "할 일 댓글 대화 조회", operationId: "getTodoConversation" })
  @ApiSuccessResponse({ type: TodoConversationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  @ApiBadRequestError(ErrorCode.SYS_0002)
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Query({ schema: GetTodoConversationQueryDto }) query: GetTodoConversationQueryDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoConversationResponseDto> {
    const result = await this.getTodoConversationUseCase.execute({
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
  @ApiDoc({ summary: "할 일 댓글 작성 (한 번에 이어 쓰기 가능)", operationId: "createTodoComment" })
  @ApiCreatedResponse({ type: TodoCommentChainResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiNotFoundError(ErrorCode.TODO_0801)
  async writeComments(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoDetailsParamDto }) params: TodoDetailsParamDto,
    @Body({ schema: WriteTodoCommentChainDto }) body: WriteTodoCommentChainDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentChainResponseDto> {
    const result = await this.writeTodoCommentChainUseCase.execute({
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
  @ApiDoc({ summary: "본인 댓글 수정", operationId: "updateTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentMutationResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.TODO_0832)
  async updateComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
    @Body({ schema: UpdateTodoCommentDto }) body: UpdateTodoCommentDto,

    @Headers("x-app-version") appVersion?: string,
  ): Promise<TodoCommentMutationResponseDto> {
    const result = await this.updateTodoCommentUseCase.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
      content: body.content,
    });
    return TodoCommentMapper.toMutation(result, appVersion);
  }

  @Delete("comments/:commentId")
  @ApiDoc({ summary: "본인 댓글 삭제", operationId: "deleteTodoComment" })
  @ApiSuccessResponse({ type: DeleteTodoCommentResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.TODO_0832)
  deleteComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<DeleteTodoCommentResponseDto> {
    return this.deleteTodoCommentUseCase.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }

  @Put("comments/:commentId/likes")
  @ApiDoc({ summary: "댓글 좋아요", operationId: "likeTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  likeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    return this.likeTodoCommentUseCase.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }

  @Delete("comments/:commentId/likes")
  @ApiDoc({ summary: "댓글 좋아요 취소", operationId: "unlikeTodoComment" })
  @ApiSuccessResponse({ type: TodoCommentLikeResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  unlikeComment(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: TodoCommentIdParamDto }) params: TodoCommentIdParamDto,
  ): Promise<TodoCommentLikeResponseDto> {
    return this.unlikeTodoCommentUseCase.execute({
      todoId: params.todoId,
      commentId: params.commentId,
      userId: user.userId,
    });
  }
}
