import type { Provider } from "@nestjs/common";

import {
  TodoEngagementCounterPort,
  TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoCommentAccountCleanupPort } from "./application/ports/todo-comment-account-cleanup.port.js";
import { TodoCommentBlockReaderPort } from "./application/ports/todo-comment-block-reader.port.js";
import { TodoCommentCursorCodecPort } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TodoCommentLikeRepositoryPort } from "./application/ports/todo-comment-like.repository.port.js";
import { TodoCommentNotificationPort } from "./application/ports/todo-comment-notification.port.js";
import { TodoCommentPurgeRepositoryPort } from "./application/ports/todo-comment-purge.repository.port.js";
import { TodoCommentReaderPort } from "./application/ports/todo-comment.reader.port.js";
import { TodoCommentRepositoryPort } from "./application/ports/todo-comment.repository.port.js";
import { CleanUpAccountTodoCommentsUseCase } from "./application/use-cases/clean-up-account-todo-comments.use-case.js";
import { DeleteTodoCommentUseCase } from "./application/use-cases/delete-todo-comment.use-case.js";
import { GetTodoConversationUseCase } from "./application/use-cases/get-todo-conversation.use-case.js";
import { GetTodoDetailsUseCase } from "./application/use-cases/get-todo-details.use-case.js";
import { InvalidateCleanedTodoCachesUseCase } from "./application/use-cases/invalidate-cleaned-todo-caches.use-case.js";
import { LikeTodoCommentUseCase } from "./application/use-cases/like-todo-comment.use-case.js";
import { ListTodoCommentRepliesUseCase } from "./application/use-cases/list-todo-comment-replies.use-case.js";
import { ListTodoCommentThreadsUseCase } from "./application/use-cases/list-todo-comment-threads.use-case.js";
import { UnlikeTodoCommentUseCase } from "./application/use-cases/unlike-todo-comment.use-case.js";
import { UpdateTodoCommentUseCase } from "./application/use-cases/update-todo-comment.use-case.js";
import { WriteTodoCommentChainUseCase } from "./application/use-cases/write-todo-comment-chain.use-case.js";
import { HmacTodoCommentCursorCodecAdapter } from "./infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter.js";
import { TodoCommentAccountCleanupAdapter } from "./infrastructure/adapters/todo-comment-account-cleanup.adapter.js";
import { TodoCommentBlockReaderAdapter } from "./infrastructure/adapters/todo-comment-block-reader.adapter.js";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter.js";
import { DrizzleTodoCommentLikeRepository } from "./infrastructure/persistence/drizzle-todo-comment-like.repository.js";
import { DrizzleTodoCommentPurgeRepository } from "./infrastructure/persistence/drizzle-todo-comment-purge.repository.js";
import { DrizzleTodoCommentReader } from "./infrastructure/persistence/drizzle-todo-comment.reader.js";
import { DrizzleTodoCommentRepository } from "./infrastructure/persistence/drizzle-todo-comment.repository.js";

export const ENGAGEMENT_COMMENTS_PROVIDERS = [
  { provide: TodoCommentRepositoryPort, useClass: DrizzleTodoCommentRepository },
  { provide: TodoCommentLikeRepositoryPort, useClass: DrizzleTodoCommentLikeRepository },
  { provide: TodoCommentPurgeRepositoryPort, useClass: DrizzleTodoCommentPurgeRepository },
  { provide: TodoCommentReaderPort, useClass: DrizzleTodoCommentReader },
  { provide: TodoCommentCursorCodecPort, useClass: HmacTodoCommentCursorCodecAdapter },
  { provide: TodoCommentNotificationPort, useClass: TodoCommentNotificationAdapter },
  { provide: TodoCommentBlockReaderPort, useClass: TodoCommentBlockReaderAdapter },
  { provide: TodoCommentAccountCleanupPort, useClass: TodoCommentAccountCleanupAdapter },
  provideUseCase(GetTodoDetailsUseCase, {
    unitOfWork: UnitOfWorkPort,
    reader: TodoCommentReaderPort,
    engagementCounter: TodoEngagementCounterPort,
  }),
  provideUseCase(ListTodoCommentThreadsUseCase, {
    reader: TodoCommentReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(ListTodoCommentRepliesUseCase, {
    reader: TodoCommentReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(GetTodoConversationUseCase, {
    reader: TodoCommentReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(WriteTodoCommentChainUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    reader: TodoCommentReaderPort,
    repository: TodoCommentRepositoryPort,
    engagementCounter: TodoEngagementCounterPort,
    notification: TodoCommentNotificationPort,
    blockReader: TodoCommentBlockReaderPort,
    todoViewCache: TodoViewCacheInvalidatorPort,
    logger: loggerFor(WriteTodoCommentChainUseCase),
  }),
  provideUseCase(UpdateTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    reader: TodoCommentReaderPort,
    repository: TodoCommentRepositoryPort,
  }),
  provideUseCase(DeleteTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    reader: TodoCommentReaderPort,
    repository: TodoCommentRepositoryPort,
    likeRepository: TodoCommentLikeRepositoryPort,
    engagementCounter: TodoEngagementCounterPort,
    todoViewCache: TodoViewCacheInvalidatorPort,
    logger: loggerFor(DeleteTodoCommentUseCase),
  }),
  provideUseCase(LikeTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    reader: TodoCommentReaderPort,
    repository: TodoCommentRepositoryPort,
    likeRepository: TodoCommentLikeRepositoryPort,
    notification: TodoCommentNotificationPort,
    blockReader: TodoCommentBlockReaderPort,
    logger: loggerFor(LikeTodoCommentUseCase),
  }),
  provideUseCase(UnlikeTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    reader: TodoCommentReaderPort,
    repository: TodoCommentRepositoryPort,
    likeRepository: TodoCommentLikeRepositoryPort,
  }),
  provideUseCase(CleanUpAccountTodoCommentsUseCase, {
    mutationLock: MutationLockPort,
    clock: ClockPort,
    purgeRepository: TodoCommentPurgeRepositoryPort,
    engagementCounter: TodoEngagementCounterPort,
  }),
  provideUseCase(InvalidateCleanedTodoCachesUseCase, {
    todoViewCache: TodoViewCacheInvalidatorPort,
    logger: loggerFor(InvalidateCleanedTodoCachesUseCase),
  }),
] satisfies Provider[];
