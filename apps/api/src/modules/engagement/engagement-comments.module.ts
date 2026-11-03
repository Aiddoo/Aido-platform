import { Module } from "@nestjs/common";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/planning-todos.public";
import { SocialBlocksModule, USER_BLOCK_READER } from "#api/modules/social/social-blocks.public";

import { TODO_COMMENT_ACCOUNT_CLEANUP } from "./application/ports/comments/todo-comment-account-cleanup.port.js";
import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/comments/todo-comment-account-cleanup.store.port.js";
import { TODO_COMMENT_BLOCK_READER } from "./application/ports/comments/todo-comment-block-reader.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/comments/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/comments/todo-comment-notification.port.js";
import { TODO_COMMENT_READER } from "./application/ports/comments/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/comments/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/comments/todo-view-cache.port.js";
import { TodoCommentAccountCleanup } from "./application/services/comments/todo-comment-account-cleanup.service.js";
import {
  deleteTodoCommentProvider,
  getTodoCommentRepliesProvider,
  getTodoCommentThreadsProvider,
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
import { DrizzleTodoCommentAccountCleanupStore } from "./infrastructure/persistence/comments/drizzle-todo-comment-account-cleanup.store.js";
import { DrizzleTodoCommentReader } from "./infrastructure/persistence/comments/drizzle-todo-comment.reader.js";
import { DrizzleTodoCommentRepository } from "./infrastructure/persistence/comments/drizzle-todo-comment.repository.js";
import { HmacTodoCommentCursorCodec } from "./infrastructure/security/comments/hmac-todo-comment-cursor.codec.js";
import { TodoCommentController } from "./presentation/controllers/comments/v1/todo-comment.controller.js";
import { TodoCommentV2Controller } from "./presentation/controllers/comments/v2/todo-comment.controller.js";

@Module({
  imports: [NotificationDeliveryModule, PlanningTodosModule, SocialBlocksModule],
  controllers: [TodoCommentController, TodoCommentV2Controller],
  providers: [
    HmacTodoCommentCursorCodec,
    { provide: TODO_COMMENT_CURSOR_CODEC, useExisting: HmacTodoCommentCursorCodec },
    DrizzleTodoCommentReader,
    { provide: TODO_COMMENT_READER, useExisting: DrizzleTodoCommentReader },
    DrizzleTodoCommentRepository,
    { provide: TODO_COMMENT_REPOSITORY, useExisting: DrizzleTodoCommentRepository },
    DrizzleTodoCommentAccountCleanupStore,
    {
      provide: TODO_COMMENT_ACCOUNT_CLEANUP_STORE,
      useExisting: DrizzleTodoCommentAccountCleanupStore,
    },
    { provide: TODO_COMMENT_NOTIFICATION, useClass: TodoCommentNotificationAdapter },
    { provide: TODO_VIEW_CACHE, useClass: TodoViewCacheAdapter },
    { provide: TODO_COMMENT_BLOCK_READER, useExisting: USER_BLOCK_READER },
    getTodoDetailsProvider,
    getTodoCommentRepliesProvider,
    getTodoCommentThreadsProvider,
    getTodoConversationProvider,
    todoCommentAccountCleanupProvider,
    { provide: TODO_COMMENT_ACCOUNT_CLEANUP, useExisting: TodoCommentAccountCleanup },
    writeTodoCommentChainProvider,
    updateTodoCommentProvider,
    deleteTodoCommentProvider,
    likeTodoCommentProvider,
    unlikeTodoCommentProvider,
  ],
  exports: [TODO_COMMENT_ACCOUNT_CLEANUP],
})
export class EngagementCommentsModule {}
