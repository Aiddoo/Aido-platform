import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/planning-todos.public";

import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/comments/todo-comment-account-cleanup.store.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/comments/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/comments/todo-comment-notification.port.js";
import { TODO_COMMENT_READER } from "./application/ports/comments/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/comments/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/comments/todo-view-cache.port.js";
import { TodoCommentAccountCleanup } from "./application/services/comments/todo-comment-account-cleanup.js";
import {
  deleteTodoCommentProvider,
  getTodoCommentOverviewProvider,
  getTodoConversationProvider,
  getTodoDetailsProvider,
  likeTodoCommentProvider,
  todoCommentAccountCleanupProvider,
  unlikeTodoCommentProvider,
  updateTodoCommentProvider,
  writeTodoCommentChainProvider,
} from "./engagement-comments-application.providers.js";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/comments/todo-comment-notification.adapter.js";
import { TodoViewCacheAdapter } from "./infrastructure/adapters/comments/todo-view-cache.adapter.js";
import { PrismaTodoCommentAccountCleanupStore } from "./infrastructure/persistence/comments/prisma-todo-comment-account-cleanup.store.js";
import { PrismaTodoCommentReader } from "./infrastructure/persistence/comments/prisma-todo-comment.reader.js";
import { PrismaTodoCommentRepository } from "./infrastructure/persistence/comments/prisma-todo-comment.repository.js";
import { HmacTodoCommentCursorCodec } from "./infrastructure/security/comments/hmac-todo-comment-cursor.codec.js";
import { TodoCommentController } from "./presentation/controllers/comments/todo-comment.controller.js";

@Module({
  imports: [NotificationModule, PlanningTodosModule],
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
    getTodoDetailsProvider,
    getTodoCommentOverviewProvider,
    getTodoConversationProvider,
    todoCommentAccountCleanupProvider,
    writeTodoCommentChainProvider,
    updateTodoCommentProvider,
    deleteTodoCommentProvider,
    likeTodoCommentProvider,
    unlikeTodoCommentProvider,
  ],
  exports: [TodoCommentAccountCleanup],
})
export class TodoCommentModule {}
