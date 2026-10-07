import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/notification/index";
import { TodoModule } from "#api/todo/index";

import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/todo-comment-account-cleanup.store.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port.js";
import { TODO_COMMENT_READER } from "./application/ports/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/todo-view-cache.port.js";
import {
  GetTodoCommentOverviewUseCase,
  GetTodoConversationUseCase,
  GetTodoDetailsUseCase,
} from "./application/queries/index.js";
import { TodoCommentAccountCleanup } from "./application/services/todo-comment-account-cleanup.js";
import {
  DeleteTodoCommentUseCase,
  LikeTodoCommentUseCase,
  UnlikeTodoCommentUseCase,
  UpdateTodoCommentUseCase,
  WriteTodoCommentChainUseCase,
} from "./application/use-cases/index.js";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter.js";
import { TodoViewCacheAdapter } from "./infrastructure/adapters/todo-view-cache.adapter.js";
import { PrismaTodoCommentAccountCleanupStore } from "./infrastructure/persistence/prisma-todo-comment-account-cleanup.store.js";
import { PrismaTodoCommentReader } from "./infrastructure/persistence/prisma-todo-comment.reader.js";
import { PrismaTodoCommentRepository } from "./infrastructure/persistence/prisma-todo-comment.repository.js";
import { HmacTodoCommentCursorCodec } from "./infrastructure/security/hmac-todo-comment-cursor.codec.js";
import { TodoCommentController } from "./presentation/todo-comment.controller.js";

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
