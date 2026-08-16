import { Module } from "@nestjs/common";

import { NotificationModule } from "@/notification";

import { TODO_COMMENT_CACHE } from "./application/ports/todo-comment-cache.port";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port";
import {
	GetTodoCommentThreadUseCase,
	GetTodoDetailsUseCase,
	ListTodoCommentRepliesUseCase,
	ListTodoCommentsUseCase,
} from "./application/queries";
import {
	DeleteTodoCommentUseCase,
	LikeTodoCommentUseCase,
	UnlikeTodoCommentUseCase,
	UpdateTodoCommentUseCase,
	WriteTodoCommentChainUseCase,
} from "./application/use-cases";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter";
import { TodoCommentCacheAdapter } from "./infrastructure/cache/todo-comment-cache.adapter";
import { PrismaTodoCommentRepository } from "./infrastructure/persistence/prisma-todo-comment.repository";
import { TodoCommentController } from "./presentation/todo-comment.controller";

@Module({
	imports: [NotificationModule],
	controllers: [TodoCommentController],
	providers: [
		PrismaTodoCommentRepository,
		{ provide: TODO_COMMENT_REPOSITORY, useExisting: PrismaTodoCommentRepository },
		{ provide: TODO_COMMENT_CACHE, useClass: TodoCommentCacheAdapter },
		{ provide: TODO_COMMENT_NOTIFICATION, useClass: TodoCommentNotificationAdapter },
		GetTodoDetailsUseCase,
		ListTodoCommentsUseCase,
		ListTodoCommentRepliesUseCase,
		GetTodoCommentThreadUseCase,
		WriteTodoCommentChainUseCase,
		UpdateTodoCommentUseCase,
		DeleteTodoCommentUseCase,
		LikeTodoCommentUseCase,
		UnlikeTodoCommentUseCase,
	],
})
export class TodoCommentModule {}
