import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK, MUTATION_LOCK } from "#api/shared/application/ports/index";

import { TODO_COMMENT_BLOCK_READER } from "./application/ports/todo-comment-block-reader.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port.js";
import { TODO_COMMENT_ACCOUNT_CLEANUP_STORE } from "./application/ports/todo-comment-purge.repository.port.js";
import { TODO_COMMENT_READER } from "./application/ports/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/todo-view-cache.port.js";
import { TodoCommentAccountCleanup } from "./application/use-cases/clean-up-account-todo-comments.use-case.js";
import { DeleteTodoComment } from "./application/use-cases/delete-todo-comment.use-case.js";
import { GetTodoCommentReplies } from "./application/use-cases/get-todo-comment-replies.use-case.js";
import { GetTodoCommentThreads } from "./application/use-cases/get-todo-comment-threads.use-case.js";
import { GetTodoConversation } from "./application/use-cases/get-todo-conversation.use-case.js";
import { GetTodoDetails } from "./application/use-cases/get-todo-details.use-case.js";
import { LikeTodoComment } from "./application/use-cases/like-todo-comment.use-case.js";
import { UnlikeTodoComment } from "./application/use-cases/unlike-todo-comment.use-case.js";
import { UpdateTodoComment } from "./application/use-cases/update-todo-comment.use-case.js";
import { WriteTodoCommentChain } from "./application/use-cases/write-todo-comment-chain.use-case.js";

export const getTodoCommentThreadsProvider: FactoryProvider<GetTodoCommentThreads> = {
  provide: GetTodoCommentThreads,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoCommentThreads>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoCommentThreads>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof GetTodoCommentThreads>[0]["blockReader"],
  ) => new GetTodoCommentThreads({ reader, cursorCodec, blockReader }),
};

export const getTodoCommentRepliesProvider: FactoryProvider<GetTodoCommentReplies> = {
  provide: GetTodoCommentReplies,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoCommentReplies>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoCommentReplies>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof GetTodoCommentReplies>[0]["blockReader"],
  ) => new GetTodoCommentReplies({ reader, cursorCodec, blockReader }),
};

export const getTodoConversationProvider: FactoryProvider<GetTodoConversation> = {
  provide: GetTodoConversation,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoConversation>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoConversation>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof GetTodoConversation>[0]["blockReader"],
  ) => new GetTodoConversation({ reader, cursorCodec, blockReader }),
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
    TODO_COMMENT_BLOCK_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof LikeTodoComment>[0]["reader"],
    repository: ConstructorParameters<typeof LikeTodoComment>[0]["repository"],
    notification: ConstructorParameters<typeof LikeTodoComment>[0]["notification"],
    blockReader: ConstructorParameters<typeof LikeTodoComment>[0]["blockReader"],
    mutationLock: ConstructorParameters<typeof LikeTodoComment>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof LikeTodoComment>[0]["unitOfWork"],
  ) =>
    new LikeTodoComment({
      reader,
      repository,
      notification,
      blockReader,
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
    TODO_COMMENT_BLOCK_READER,
    TODO_VIEW_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof WriteTodoCommentChain>[0]["reader"],
    repository: ConstructorParameters<typeof WriteTodoCommentChain>[0]["repository"],
    notification: ConstructorParameters<typeof WriteTodoCommentChain>[0]["notification"],
    blockReader: ConstructorParameters<typeof WriteTodoCommentChain>[0]["blockReader"],
    todoViewCache: ConstructorParameters<typeof WriteTodoCommentChain>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof WriteTodoCommentChain>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof WriteTodoCommentChain>[0]["unitOfWork"],
  ) =>
    new WriteTodoCommentChain({
      reader,
      repository,
      notification,
      blockReader,
      todoViewCache,
      mutationLock,
      unitOfWork,
      logger: new Logger(WriteTodoCommentChain.name),
    }),
};
