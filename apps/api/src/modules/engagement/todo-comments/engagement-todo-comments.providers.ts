import type { Provider } from "@nestjs/common";

import {
  TodoCommentLikeReaderPort,
  TodoCommentLikeRepositoryPort,
} from "#api/modules/engagement/todo-comment-likes/engagement-todo-comment-likes.public";
import {
  TodoEngagementCounterPort,
  TodoViewCacheInvalidatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { MutualFriendReaderPort } from "#api/modules/social/friendships/social-friendships.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoCommentAccessReaderPort } from "./application/ports/todo-comment-access.reader.port.js";
import { TodoCommentAccountCleanupPort } from "./application/ports/todo-comment-account-cleanup.port.js";
import { TodoCommentBlockReaderPort } from "./application/ports/todo-comment-block-reader.port.js";
import { TodoCommentCursorCodecPort } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TodoCommentNotificationPort } from "./application/ports/todo-comment-notification.port.js";
import { TodoCommentPurgeRepositoryPort } from "./application/ports/todo-comment-purge.repository.port.js";
import { TodoCommentReplyReaderPort } from "./application/ports/todo-comment-reply.reader.port.js";
import { TodoCommentThreadReaderPort } from "./application/ports/todo-comment-thread.reader.port.js";
import { TodoCommentReaderPort } from "./application/ports/todo-comment.reader.port.js";
import { TodoCommentRepositoryPort } from "./application/ports/todo-comment.repository.port.js";
import { TodoConversationReaderPort } from "./application/ports/todo-conversation.reader.port.js";
import { CleanUpAccountTodoCommentsUseCase } from "./application/use-cases/clean-up-account-todo-comments.use-case.js";
import { DeleteTodoCommentUseCase } from "./application/use-cases/delete-todo-comment.use-case.js";
import { EditTodoCommentUseCase } from "./application/use-cases/edit-todo-comment.use-case.js";
import { GetTodoConversationUseCase } from "./application/use-cases/get-todo-conversation.use-case.js";
import { GetTodoDetailsUseCase } from "./application/use-cases/get-todo-details.use-case.js";
import { InvalidateCleanedTodoCachesUseCase } from "./application/use-cases/invalidate-cleaned-todo-caches.use-case.js";
import { LikeTodoCommentUseCase } from "./application/use-cases/like-todo-comment.use-case.js";
import { ListTodoCommentRepliesUseCase } from "./application/use-cases/list-todo-comment-replies.use-case.js";
import { ListTodoCommentThreadsUseCase } from "./application/use-cases/list-todo-comment-threads.use-case.js";
import { UnlikeTodoCommentUseCase } from "./application/use-cases/unlike-todo-comment.use-case.js";
import { WriteTodoCommentChainUseCase } from "./application/use-cases/write-todo-comment-chain.use-case.js";
import { HmacTodoCommentCursorCodecAdapter } from "./infrastructure/adapters/hmac-todo-comment-cursor-codec.adapter.js";
import { TodoCommentAccountCleanupAdapter } from "./infrastructure/adapters/todo-comment-account-cleanup.adapter.js";
import { TodoCommentBlockReaderAdapter } from "./infrastructure/adapters/todo-comment-block-reader.adapter.js";
import { TodoCommentNotificationAdapter } from "./infrastructure/adapters/todo-comment-notification.adapter.js";
import { DrizzleTodoCommentAccessReader } from "./infrastructure/persistence/drizzle-todo-comment-access.reader.js";
import { DrizzleTodoCommentPurgeRepository } from "./infrastructure/persistence/drizzle-todo-comment-purge.repository.js";
import { DrizzleTodoCommentReplyReader } from "./infrastructure/persistence/drizzle-todo-comment-reply.reader.js";
import { DrizzleTodoCommentThreadReader } from "./infrastructure/persistence/drizzle-todo-comment-thread.reader.js";
import { DrizzleTodoCommentReader } from "./infrastructure/persistence/drizzle-todo-comment.reader.js";
import { DrizzleTodoCommentRepository } from "./infrastructure/persistence/drizzle-todo-comment.repository.js";
import { DrizzleTodoConversationReader } from "./infrastructure/persistence/drizzle-todo-conversation.reader.js";

export const ENGAGEMENT_TODO_COMMENTS_PROVIDERS = [
  { provide: TodoCommentRepositoryPort, useClass: DrizzleTodoCommentRepository },
  { provide: TodoCommentPurgeRepositoryPort, useClass: DrizzleTodoCommentPurgeRepository },
  { provide: TodoCommentAccessReaderPort, useClass: DrizzleTodoCommentAccessReader },
  { provide: TodoCommentReaderPort, useClass: DrizzleTodoCommentReader },
  { provide: TodoCommentThreadReaderPort, useClass: DrizzleTodoCommentThreadReader },
  { provide: TodoCommentReplyReaderPort, useClass: DrizzleTodoCommentReplyReader },
  { provide: TodoConversationReaderPort, useClass: DrizzleTodoConversationReader },
  { provide: TodoCommentCursorCodecPort, useClass: HmacTodoCommentCursorCodecAdapter },
  { provide: TodoCommentNotificationPort, useClass: TodoCommentNotificationAdapter },
  { provide: TodoCommentBlockReaderPort, useClass: TodoCommentBlockReaderAdapter },
  { provide: TodoCommentAccountCleanupPort, useClass: TodoCommentAccountCleanupAdapter },
  provideUseCase(GetTodoDetailsUseCase, {
    unitOfWork: UnitOfWorkPort,
    accessReader: TodoCommentAccessReaderPort,
    engagementCounter: TodoEngagementCounterPort,
    mutualFriendReader: MutualFriendReaderPort,
    clock: ClockPort,
  }),
  provideUseCase(ListTodoCommentThreadsUseCase, {
    accessReader: TodoCommentAccessReaderPort,
    reader: TodoCommentReaderPort,
    threadReader: TodoCommentThreadReaderPort,
    likeReader: TodoCommentLikeReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(ListTodoCommentRepliesUseCase, {
    accessReader: TodoCommentAccessReaderPort,
    reader: TodoCommentReaderPort,
    replyReader: TodoCommentReplyReaderPort,
    likeReader: TodoCommentLikeReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(GetTodoConversationUseCase, {
    accessReader: TodoCommentAccessReaderPort,
    reader: TodoCommentReaderPort,
    conversationReader: TodoConversationReaderPort,
    likeReader: TodoCommentLikeReaderPort,
    blockReader: TodoCommentBlockReaderPort,
    cursorCodec: TodoCommentCursorCodecPort,
  }),
  provideUseCase(WriteTodoCommentChainUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    accessReader: TodoCommentAccessReaderPort,
    reader: TodoCommentReaderPort,
    likeReader: TodoCommentLikeReaderPort,
    repository: TodoCommentRepositoryPort,
    engagementCounter: TodoEngagementCounterPort,
    notification: TodoCommentNotificationPort,
    blockReader: TodoCommentBlockReaderPort,
    todoViewCache: TodoViewCacheInvalidatorPort,
    logger: loggerFor(WriteTodoCommentChainUseCase),
  }),
  provideUseCase(EditTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    accessReader: TodoCommentAccessReaderPort,
    reader: TodoCommentReaderPort,
    likeReader: TodoCommentLikeReaderPort,
    repository: TodoCommentRepositoryPort,
  }),
  provideUseCase(DeleteTodoCommentUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    clock: ClockPort,
    accessReader: TodoCommentAccessReaderPort,
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
    accessReader: TodoCommentAccessReaderPort,
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
    accessReader: TodoCommentAccessReaderPort,
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
