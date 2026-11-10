import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK, MUTATION_LOCK } from "#api/shared/application/ports/index";

import { TODO_COMMENT_BLOCK_READER } from "./application/ports/todo-comment-block-reader.port.js";
import { TODO_COMMENT_CURSOR_CODEC } from "./application/ports/todo-comment-cursor-codec.port.js";
import { TODO_COMMENT_NOTIFICATION } from "./application/ports/todo-comment-notification.port.js";
import { TODO_COMMENT_PURGE_REPOSITORY } from "./application/ports/todo-comment-purge.repository.port.js";
import { TODO_COMMENT_READER } from "./application/ports/todo-comment.reader.port.js";
import { TODO_COMMENT_REPOSITORY } from "./application/ports/todo-comment.repository.port.js";
import { TODO_VIEW_CACHE } from "./application/ports/todo-view-cache.port.js";
import { CleanUpAccountTodoCommentsUseCase } from "./application/use-cases/clean-up-account-todo-comments.use-case.js";
import { DeleteTodoCommentUseCase } from "./application/use-cases/delete-todo-comment.use-case.js";
import { GetTodoConversationUseCase } from "./application/use-cases/get-todo-conversation.use-case.js";
import { GetTodoDetailsUseCase } from "./application/use-cases/get-todo-details.use-case.js";
import { LikeTodoCommentUseCase } from "./application/use-cases/like-todo-comment.use-case.js";
import { ListTodoCommentRepliesUseCase } from "./application/use-cases/list-todo-comment-replies.use-case.js";
import { ListTodoCommentThreadsUseCase } from "./application/use-cases/list-todo-comment-threads.use-case.js";
import { UnlikeTodoCommentUseCase } from "./application/use-cases/unlike-todo-comment.use-case.js";
import { UpdateTodoCommentUseCase } from "./application/use-cases/update-todo-comment.use-case.js";
import { WriteTodoCommentChainUseCase } from "./application/use-cases/write-todo-comment-chain.use-case.js";

export const getTodoCommentThreadsProvider: FactoryProvider<ListTodoCommentThreadsUseCase> = {
  provide: ListTodoCommentThreadsUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof ListTodoCommentThreadsUseCase>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof ListTodoCommentThreadsUseCase>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof ListTodoCommentThreadsUseCase>[0]["blockReader"],
  ) => new ListTodoCommentThreadsUseCase({ reader, cursorCodec, blockReader }),
};

export const getTodoCommentRepliesProvider: FactoryProvider<ListTodoCommentRepliesUseCase> = {
  provide: ListTodoCommentRepliesUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof ListTodoCommentRepliesUseCase>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof ListTodoCommentRepliesUseCase>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof ListTodoCommentRepliesUseCase>[0]["blockReader"],
  ) => new ListTodoCommentRepliesUseCase({ reader, cursorCodec, blockReader }),
};

export const getTodoConversationProvider: FactoryProvider<GetTodoConversationUseCase> = {
  provide: GetTodoConversationUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_CURSOR_CODEC, TODO_COMMENT_BLOCK_READER],
  useFactory: (
    reader: ConstructorParameters<typeof GetTodoConversationUseCase>[0]["reader"],
    cursorCodec: ConstructorParameters<typeof GetTodoConversationUseCase>[0]["cursorCodec"],
    blockReader: ConstructorParameters<typeof GetTodoConversationUseCase>[0]["blockReader"],
  ) => new GetTodoConversationUseCase({ reader, cursorCodec, blockReader }),
};

export const getTodoDetailsProvider: FactoryProvider<GetTodoDetailsUseCase> = {
  provide: GetTodoDetailsUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    todoCommentReader: ConstructorParameters<typeof GetTodoDetailsUseCase>[0]["todoCommentReader"],
    todoCommentRepository: ConstructorParameters<
      typeof GetTodoDetailsUseCase
    >[0]["todoCommentRepository"],
    unitOfWork: ConstructorParameters<typeof GetTodoDetailsUseCase>[0]["unitOfWork"],
  ) =>
    new GetTodoDetailsUseCase({
      todoCommentReader,
      todoCommentRepository,
      unitOfWork,
    }),
};

export const todoCommentAccountCleanupProvider: FactoryProvider<CleanUpAccountTodoCommentsUseCase> =
  {
    provide: CleanUpAccountTodoCommentsUseCase,
    inject: [TODO_COMMENT_PURGE_REPOSITORY, TODO_VIEW_CACHE, MUTATION_LOCK],
    useFactory: (
      store: ConstructorParameters<typeof CleanUpAccountTodoCommentsUseCase>[0]["store"],
      todoViewCache: ConstructorParameters<
        typeof CleanUpAccountTodoCommentsUseCase
      >[0]["todoViewCache"],
      mutationLock: ConstructorParameters<
        typeof CleanUpAccountTodoCommentsUseCase
      >[0]["mutationLock"],
    ) =>
      new CleanUpAccountTodoCommentsUseCase({
        store,
        todoViewCache,
        mutationLock,
        logger: new Logger(CleanUpAccountTodoCommentsUseCase.name),
      }),
  };

export const deleteTodoCommentProvider: FactoryProvider<DeleteTodoCommentUseCase> = {
  provide: DeleteTodoCommentUseCase,
  inject: [
    TODO_COMMENT_READER,
    TODO_COMMENT_REPOSITORY,
    TODO_VIEW_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof DeleteTodoCommentUseCase>[0]["reader"],
    repository: ConstructorParameters<typeof DeleteTodoCommentUseCase>[0]["repository"],
    todoViewCache: ConstructorParameters<typeof DeleteTodoCommentUseCase>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof DeleteTodoCommentUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoCommentUseCase>[0]["unitOfWork"],
  ) =>
    new DeleteTodoCommentUseCase({
      reader,
      repository,
      todoViewCache,
      mutationLock,
      unitOfWork,
      logger: new Logger(DeleteTodoCommentUseCase.name),
    }),
};

export const likeTodoCommentProvider: FactoryProvider<LikeTodoCommentUseCase> = {
  provide: LikeTodoCommentUseCase,
  inject: [
    TODO_COMMENT_READER,
    TODO_COMMENT_REPOSITORY,
    TODO_COMMENT_NOTIFICATION,
    TODO_COMMENT_BLOCK_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    reader: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["reader"],
    repository: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["repository"],
    notification: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["notification"],
    blockReader: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["blockReader"],
    mutationLock: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof LikeTodoCommentUseCase>[0]["unitOfWork"],
  ) =>
    new LikeTodoCommentUseCase({
      reader,
      repository,
      notification,
      blockReader,
      mutationLock,
      unitOfWork,
      logger: new Logger(LikeTodoCommentUseCase.name),
    }),
};

export const unlikeTodoCommentProvider: FactoryProvider<UnlikeTodoCommentUseCase> = {
  provide: UnlikeTodoCommentUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    reader: ConstructorParameters<typeof UnlikeTodoCommentUseCase>[0]["reader"],
    repository: ConstructorParameters<typeof UnlikeTodoCommentUseCase>[0]["repository"],
    mutationLock: ConstructorParameters<typeof UnlikeTodoCommentUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UnlikeTodoCommentUseCase>[0]["unitOfWork"],
  ) =>
    new UnlikeTodoCommentUseCase({
      reader,
      repository,
      mutationLock,
      unitOfWork,
    }),
};

export const updateTodoCommentProvider: FactoryProvider<UpdateTodoCommentUseCase> = {
  provide: UpdateTodoCommentUseCase,
  inject: [TODO_COMMENT_READER, TODO_COMMENT_REPOSITORY, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    reader: ConstructorParameters<typeof UpdateTodoCommentUseCase>[0]["reader"],
    repository: ConstructorParameters<typeof UpdateTodoCommentUseCase>[0]["repository"],
    mutationLock: ConstructorParameters<typeof UpdateTodoCommentUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoCommentUseCase>[0]["unitOfWork"],
  ) =>
    new UpdateTodoCommentUseCase({
      reader,
      repository,
      mutationLock,
      unitOfWork,
    }),
};

export const writeTodoCommentChainProvider: FactoryProvider<WriteTodoCommentChainUseCase> = {
  provide: WriteTodoCommentChainUseCase,
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
    reader: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["reader"],
    repository: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["repository"],
    notification: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["notification"],
    blockReader: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["blockReader"],
    todoViewCache: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["todoViewCache"],
    mutationLock: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof WriteTodoCommentChainUseCase>[0]["unitOfWork"],
  ) =>
    new WriteTodoCommentChainUseCase({
      reader,
      repository,
      notification,
      blockReader,
      todoViewCache,
      mutationLock,
      unitOfWork,
      logger: new Logger(WriteTodoCommentChainUseCase.name),
    }),
};
