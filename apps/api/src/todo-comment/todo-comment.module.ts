import { Module } from "@nestjs/common";

import { NotificationModule } from "@/notification";
import { TodoModule } from "@/todo";

import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/todo-comment-account-cleanup.store.port";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/todo-comment-cursor-codec.port";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port";
import { TODO_COMMENT_READER } from "./application/ports/todo-comment.reader.port";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port";
import { TODO_VIEW_CACHE } from "./application/ports/todo-view-cache.port";
import {
	GetTodoCommentOverviewUseCase,
	GetTodoConversationUseCase,
	GetTodoDetailsUseCase,
} from "./application/queries";
import { TodoCommentAccountCleanup } from "./application/services/todo-comment-account-cleanup";
import {
	DeleteTodoCommentUseCase,
	LikeTodoCommentUseCase,
	UnlikeTodoCommentUseCase,
	UpdateTodoCommentUseCase,
	WriteTodoCommentChainUseCase,
} from "./application/use-cases";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter";
import { TodoViewCacheAdapter } from "./infrastructure/adapters/todo-view-cache.adapter";
import { PrismaTodoCommentAccountCleanupStore } from "./infrastructure/persistence/prisma-todo-comment-account-cleanup.store";
import { PrismaTodoCommentReader } from "./infrastructure/persistence/prisma-todo-comment.reader";
import { PrismaTodoCommentRepository } from "./infrastructure/persistence/prisma-todo-comment.repository";
import { HmacTodoCommentCursorCodec } from "./infrastructure/security/hmac-todo-comment-cursor.codec";
import { TodoCommentController } from "./presentation/todo-comment.controller";

@Module({
	imports: [NotificationModule, TodoModule],
	controllers: [TodoCommentController],
	providers: [
		HmacTodoCommentCursorCodec,
		{ provide: TODO_COMMENT_CURSOR_CODEC, useExisting: HmacTodoCommentCursorCodec },
		PrismaTodoCommentReader,
		{ provide: TODO_COMMENT_READER, useExisting: PrismaTodoCommentReader },
		PrismaTodoCommentRepository,
		{ provide: TODO_COMMENT_REPOSITORY, useExisting: PrismaTodoCommentRepository },
		PrismaTodoCommentAccountCleanupStore,
		{
			provide: TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
			useExisting: PrismaTodoCommentAccountCleanupStore,
		},
		{ provide: TODO_COMMENT_NOTIFICATION, useClass: TodoCommentNotificationAdapter },
		{ provide: TODO_VIEW_CACHE, useClass: TodoViewCacheAdapter },
		GetTodoDetailsUseCase,
		GetTodoCommentOverviewUseCase,
		GetTodoConversationUseCase,
		TodoCommentAccountCleanup,
		WriteTodoCommentChainUseCase,
		UpdateTodoCommentUseCase,
		DeleteTodoCommentUseCase,
		LikeTodoCommentUseCase,
		UnlikeTodoCommentUseCase,
	],
	exports: [TodoCommentAccountCleanup],
})
export class TodoCommentModule {}
