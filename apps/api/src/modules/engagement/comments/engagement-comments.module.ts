import { Module } from "@nestjs/common";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { SocialBlocksModule, USER_BLOCK_READER } from "#api/modules/social/social-blocks.public";

import { TODO_COMMENT_ACCOUNT_CLEANUP } from "./application/ports/todo-comment-account-cleanup.port.js";
import { TODO_COMMENT_BLOCK_READER } from "./application/ports/todo-comment-block-reader.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port.js";
import { TODO_COMMENT_PURGE_REPOSITORY } from "./application/ports/todo-comment-purge.repository.port.js";
import { TODO_COMMENT_READER } from "./application/ports/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/todo-view-cache.port.js";
import { CleanUpAccountTodoCommentsUseCase } from "./application/use-cases/clean-up-account-todo-comments.use-case.js";
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
} from "./engagement-comments.providers.js";
import { HmacTodoCommentCursorCodecAdapter } from "./infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter.js";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter.js";
import { TodoViewCacheAdapter } from "./infrastructure/adapters/todo-view-cache.adapter.js";
import { DrizzleTodoCommentPurgeRepository } from "./infrastructure/persistence/drizzle-todo-comment-purge.repository.js";
import { DrizzleTodoCommentReader } from "./infrastructure/persistence/drizzle-todo-comment.reader.js";
import { DrizzleTodoCommentRepository } from "./infrastructure/persistence/drizzle-todo-comment.repository.js";
import { TodoCommentController } from "./presentation/http/v1/todo-comment.controller.js";
import { TodoCommentV2Controller } from "./presentation/http/v2/todo-comment.controller.js";

@Module({
  imports: [NotificationDeliveryModule, PlanningTodosModule, SocialBlocksModule],
  controllers: [TodoCommentController, TodoCommentV2Controller],
  providers: [
    HmacTodoCommentCursorCodecAdapter,
    { provide: TODO_COMMENT_CURSOR_CODEC, useExisting: HmacTodoCommentCursorCodecAdapter },
    DrizzleTodoCommentReader,
    { provide: TODO_COMMENT_READER, useExisting: DrizzleTodoCommentReader },
    DrizzleTodoCommentRepository,
    { provide: TODO_COMMENT_REPOSITORY, useExisting: DrizzleTodoCommentRepository },
    DrizzleTodoCommentPurgeRepository,
    {
      provide: TODO_COMMENT_PURGE_REPOSITORY,
      useExisting: DrizzleTodoCommentPurgeRepository,
    },
    { provide: TODO_COMMENT_NOTIFICATION, useClass: TodoCommentNotificationAdapter },
    { provide: TODO_VIEW_CACHE, useClass: TodoViewCacheAdapter },
    { provide: TODO_COMMENT_BLOCK_READER, useExisting: USER_BLOCK_READER },
    getTodoDetailsProvider,
    getTodoCommentRepliesProvider,
    getTodoCommentThreadsProvider,
    getTodoConversationProvider,
    todoCommentAccountCleanupProvider,
    { provide: TODO_COMMENT_ACCOUNT_CLEANUP, useExisting: CleanUpAccountTodoCommentsUseCase },
    writeTodoCommentChainProvider,
    updateTodoCommentProvider,
    deleteTodoCommentProvider,
    likeTodoCommentProvider,
    unlikeTodoCommentProvider,
  ],
  exports: [TODO_COMMENT_ACCOUNT_CLEANUP],
})
export class EngagementCommentsModule {}
