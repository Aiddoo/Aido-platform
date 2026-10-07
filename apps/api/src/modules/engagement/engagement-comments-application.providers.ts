import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK, MUTATION_LOCK } from "#api/shared/application/ports/index";

import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/comments/todo-comment-account-cleanup.store.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/comments/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/comments/todo-comment-notification.port.js";
import { TODO_COMMENT_READER } from "./application/ports/comments/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/comments/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/comments/todo-view-cache.port.js";
import { TodoCommentAccountCleanup } from "./application/services/comments/todo-comment-account-cleanup.js";
import { DeleteTodoComment } from "./application/use-cases/comments/delete-todo-comment.use-case.js";
import { GetTodoCommentOverview } from "./application/use-cases/comments/get-todo-comment-overview.use-case.js";
import { GetTodoConversation } from "./application/use-cases/comments/get-todo-conversation.use-case.js";
import { GetTodoDetails } from "./application/use-cases/comments/get-todo-details.use-case.js";
import { LikeTodoComment } from "./application/use-cases/comments/like-todo-comment.use-case.js";
import { UnlikeTodoComment } from "./application/use-cases/comments/unlike-todo-comment.use-case.js";
import { UpdateTodoComment } from "./application/use-cases/comments/update-todo-comment.use-case.js";
import { WriteTodoCommentChain } from "./application/use-cases/comments/write-todo-comment-chain.use-case.js";

export const getTodoCommentOverviewProvider: FactoryProvider<GetTodoCommentOverview> = {
  provide: GetTodoCommentOverview,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoCommentOverview>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoCommentOverview>[0]["cursorCodec"],
  ) => new GetTodoCommentOverview({ reader, cursorCodec }),
};

export const getTodoConversationProvider: FactoryProvider<GetTodoConversation> = {
  provide: GetTodoConversation,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoConversation>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoConversation>[0]["cursorCodec"],
  ) => new GetTodoConversation({ reader, cursorCodec }),
};

export const getTodoDetailsProvider: FactoryProvider<GetTodoDetails> = {
  provide: GetTodoDetails,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    todoCommentReader: ConstructorParameters<typeof GetTodoDetails>[0]["todoCommentReader"],
    todoCommentRepository: ConstructorParameters<typeof GetTodoDetails>[0]["todoCommentRepository"],
    unitOfWork: ConstructorParameters<typeof GetTodoDetails>[0]["unitOfWork"],
  ) =>
    new GetTodoDetails({
      todoCommentReader,
      todoCommentRepository,
      unitOfWork,
    }),
};

export const todoCommentAccountCleanupProvider: FactoryProvider<TodoCommentAccountCleanup> = {
  provide: TodoCommentAccountCleanup,
  inject: [TODO_COMMENT_ACCOUNT_CLEANUP_STORE, TODO_VIEW_CACHE, MUTATION_LOCK],
  useFactory: (
    store: ConstructorParameters<typeof TodoCommentAccountCleanup>[0]["store"],
    todoViewCache: ConstructorParameters<typeof TodoCommentAccountCleanup>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof TodoCommentAccountCleanup>[0]["mutationLock"],
  ) =>
    new TodoCommentAccountCleanup({
      store,
      todoViewCache,
      mutationLock,
      logger: new Logger(TodoCommentAccountCleanup.name),
    }),
};

export const deleteTodoCommentProvider: FactoryProvider<DeleteTodoComment> = {
  provide: DeleteTodoComment,
  inject: [
    TODO_COMMENT_READER,
    TODO_COMMENT_REPOSITORY,
    TODO_VIEW_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof DeleteTodoComment>[0]["reader"],
    repository: ConstructorParameters<typeof DeleteTodoComment>[0]["repository"],
    todoViewCache: ConstructorParameters<typeof DeleteTodoComment>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof DeleteTodoComment>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoComment>[0]["unitOfWork"],
  ) =>
    new DeleteTodoComment({
      reader,
      repository,
      todoViewCache,
      mutationLock,
      unitOfWork,
      logger: new Logger(DeleteTodoComment.name),
    }),
};

export const likeTodoCommentProvider: FactoryProvider<LikeTodoComment> = {
  provide: LikeTodoComment,
  inject: [
    TODO_COMMENT_READER,
    TODO_COMMENT_REPOSITORY,
    TODO_COMMENT_NOTIFICATION,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof LikeTodoComment>[0]["reader"],
    repository: ConstructorParameters<typeof LikeTodoComment>[0]["repository"],
    notification: ConstructorParameters<typeof LikeTodoComment>[0]["notification"],
    mutationLock: ConstructorParameters<typeof LikeTodoComment>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof LikeTodoComment>[0]["unitOfWork"],
  ) =>
    new LikeTodoComment({
      reader,
      repository,
      notification,
      mutationLock,
      unitOfWork,
      logger: new Logger(LikeTodoComment.name),
    }),
};

export const unlikeTodoCommentProvider: FactoryProvider<UnlikeTodoComment> = {
  provide: UnlikeTodoComment,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    reader: ConstructorParameters<typeof UnlikeTodoComment>[0]["reader"],
    repository: ConstructorParameters<typeof UnlikeTodoComment>[0]["repository"],
    mutationLock: ConstructorParameters<typeof UnlikeTodoComment>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UnlikeTodoComment>[0]["unitOfWork"],
  ) =>
    new UnlikeTodoComment({
      reader,
      repository,
      mutationLock,
      unitOfWork,
    }),
};

export const updateTodoCommentProvider: FactoryProvider<UpdateTodoComment> = {
  provide: UpdateTodoComment,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    reader: ConstructorParameters<typeof UpdateTodoComment>[0]["reader"],
    repository: ConstructorParameters<typeof UpdateTodoComment>[0]["repository"],
    mutationLock: ConstructorParameters<typeof UpdateTodoComment>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoComment>[0]["unitOfWork"],
  ) =>
    new UpdateTodoComment({
      reader,
      repository,
      mutationLock,
      unitOfWork,
    }),
};

export const writeTodoCommentChainProvider: FactoryProvider<WriteTodoCommentChain> = {
  provide: WriteTodoCommentChain,
  inject: [
    TODO_COMMENT_READER,
    TODO_COMMENT_REPOSITORY,
    TODO_COMMENT_NOTIFICATION,
    TODO_VIEW_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WriteTodoCommentChain>[0]["reader"],
    repository: ConstructorParameters<typeof WriteTodoCommentChain>[0]["repository"],
    notification: ConstructorParameters<typeof WriteTodoCommentChain>[0]["notification"],
    todoViewCache: ConstructorParameters<typeof WriteTodoCommentChain>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof WriteTodoCommentChain>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof WriteTodoCommentChain>[0]["unitOfWork"],
  ) =>
    new WriteTodoCommentChain({
      reader,
      repository,
      notification,
      todoViewCache,
      mutationLock,
      unitOfWork,
      logger: new Logger(WriteTodoCommentChain.name),
    }),
};
