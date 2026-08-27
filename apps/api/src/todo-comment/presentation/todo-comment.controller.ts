import { ErrorCode } from "@aido/errors";
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentUser, type CurrentUserPayload } from "@/auth/presentation/decorators";
import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiForbiddenError,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import {
	GetTodoCommentOverviewUseCase,
	GetTodoConversationUseCase,
	GetTodoDetailsUseCase,
} from "../application/queries";
import {
	DeleteTodoCommentUseCase,
	LikeTodoCommentUseCase,
	UnlikeTodoCommentUseCase,
	UpdateTodoCommentUseCase,
	WriteTodoCommentChainUseCase,
} from "../application/use-cases";
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
} from "./dtos";

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

	@Get("details")
	@ApiDoc({ summary: "댓글 화면용 할 일 상세 조회", operationId: "getTodoDetails" })
	@ApiSuccessResponse({ type: TodoDetailsResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	getDetails(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoDetailsParamDto,
	): Promise<TodoDetailsResponseDto> {
		return this.getTodoDetailsUseCase.execute({ todoId: params.todoId, viewerId: user.userId });
	}

	@Get("comments/overview")
	@ApiDoc({ summary: "할 일 댓글 개요 조회", operationId: "getTodoCommentOverview" })
	@ApiSuccessResponse({ type: TodoCommentOverviewResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	getOverview(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoDetailsParamDto,
		@Query() query: GetTodoCommentOverviewQueryDto,
	): Promise<TodoCommentOverviewResponseDto> {
		return this.getTodoCommentOverviewUseCase.execute({
			todoId: params.todoId,
			viewerId: user.userId,
			sort: query.sort,
			size: query.size,
			before: query.before,
			after: query.after,
		});
	}

	@Get("conversation")
	@ApiDoc({ summary: "할 일 댓글 대화 조회", operationId: "getTodoConversation" })
	@ApiSuccessResponse({ type: TodoConversationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	@ApiBadRequestError(ErrorCode.SYS_0002)
	getConversation(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoDetailsParamDto,
		@Query() query: GetTodoConversationQueryDto,
	): Promise<TodoConversationResponseDto> {
		return this.getTodoConversationUseCase.execute({
			todoId: params.todoId,
			viewerId: user.userId,
			sort: query.sort,
			size: query.size,
			focusCommentId: query.focusCommentId,
			before: query.before,
			after: query.after,
		});
	}

	@Post("comments")
	@ApiDoc({ summary: "할 일 댓글 작성 (한 번에 이어 쓰기 가능)", operationId: "createTodoComment" })
	@ApiCreatedResponse({ type: TodoCommentChainResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiNotFoundError(ErrorCode.TODO_0801)
	writeComments(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoDetailsParamDto,
		@Body() body: WriteTodoCommentChainDto,
	): Promise<TodoCommentChainResponseDto> {
		return this.writeTodoCommentChainUseCase.execute({
			todoId: params.todoId,
			authorId: user.userId,
			parentId: body.parentId,
			items: body.items,
		});
	}

	@Patch("comments/:commentId")
	@ApiDoc({ summary: "본인 댓글 수정", operationId: "updateTodoComment" })
	@ApiSuccessResponse({ type: TodoCommentMutationResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.TODO_0832)
	updateComment(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCommentIdParamDto,
		@Body() body: UpdateTodoCommentDto,
	): Promise<TodoCommentMutationResponseDto> {
		return this.updateTodoCommentUseCase.execute({
			todoId: params.todoId,
			commentId: params.commentId,
			userId: user.userId,
			content: body.content,
		});
	}

	@Delete("comments/:commentId")
	@ApiDoc({ summary: "본인 댓글 삭제", operationId: "deleteTodoComment" })
	@ApiSuccessResponse({ type: DeleteTodoCommentResponseDto })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	@ApiForbiddenError(ErrorCode.TODO_0832)
	deleteComment(
		@CurrentUser() user: CurrentUserPayload,
		@Param() params: TodoCommentIdParamDto,
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
		@Param() params: TodoCommentIdParamDto,
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
		@Param() params: TodoCommentIdParamDto,
	): Promise<TodoCommentLikeResponseDto> {
		return this.unlikeTodoCommentUseCase.execute({
			todoId: params.todoId,
			commentId: params.commentId,
			userId: user.userId,
		});
	}
}
