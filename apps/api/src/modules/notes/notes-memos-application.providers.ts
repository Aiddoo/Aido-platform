import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import {
  UNIT_OF_WORK,
  MUTATION_LOCK,
  SAVEPOINT_RUNNER,
  AFTER_COMMIT_TASK_REGISTRY,
} from "#api/shared/application/ports/index";

import { MEMO_REPOSITORY } from "./application/ports/memos/memo.repository.port.js";
import { STAGED_TODO_CREATOR } from "./application/ports/memos/staged-todo-creator.port.js";
import { ConvertMemoToTodo } from "./application/use-cases/memos/convert-memo-to-todo.use-case.js";
import { ConvertMemoToTodos } from "./application/use-cases/memos/convert-memo-to-todos.use-case.js";
import { CreateMemo } from "./application/use-cases/memos/create-memo.use-case.js";
import { DeleteMemo } from "./application/use-cases/memos/delete-memo.use-case.js";
import { GetMemoResourceLimit } from "./application/use-cases/memos/get-memo-resource-limit.use-case.js";
import { GetMemo } from "./application/use-cases/memos/get-memo.use-case.js";
import { GetMemos } from "./application/use-cases/memos/get-memos.use-case.js";
import { ReorderMemo } from "./application/use-cases/memos/reorder-memo.use-case.js";
import { ToggleMemoPin } from "./application/use-cases/memos/toggle-memo-pin.use-case.js";
import { UpdateMemo } from "./application/use-cases/memos/update-memo.use-case.js";

export const getMemoProvider: FactoryProvider<GetMemo> = {
  provide: GetMemo,
  inject: [MEMO_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetMemo>[0]["repository"]) =>
    new GetMemo({ repository }),
};

export const getMemoResourceLimitProvider: FactoryProvider<GetMemoResourceLimit> = {
  provide: GetMemoResourceLimit,
  inject: [MEMO_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetMemoResourceLimit>[0]["repository"]) =>
    new GetMemoResourceLimit({ repository }),
};

export const getMemosProvider: FactoryProvider<GetMemos> = {
  provide: GetMemos,
  inject: [MEMO_REPOSITORY, PaginationService],
  useFactory: (
    repository: ConstructorParameters<typeof GetMemos>[0]["repository"],
    paginationService: ConstructorParameters<typeof GetMemos>[0]["paginationService"],
  ) => new GetMemos({ repository, paginationService }),
};

export const convertMemoToTodoProvider: FactoryProvider<ConvertMemoToTodo> = {
  provide: ConvertMemoToTodo,
  inject: [
    MEMO_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    STAGED_TODO_CREATOR,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof ConvertMemoToTodo>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof ConvertMemoToTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ConvertMemoToTodo>[0]["mutationLock"],
    todoCreator: ConstructorParameters<typeof ConvertMemoToTodo>[0]["todoCreator"],
    afterCommit: ConstructorParameters<typeof ConvertMemoToTodo>[0]["afterCommit"],
  ) =>
    new ConvertMemoToTodo({
      repository,
      unitOfWork,
      mutationLock,
      todoCreator,
      afterCommit,
      logger: new Logger(ConvertMemoToTodo.name),
    }),
};

export const convertMemoToTodosProvider: FactoryProvider<ConvertMemoToTodos> = {
  provide: ConvertMemoToTodos,
  inject: [
    MEMO_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    STAGED_TODO_CREATOR,
    SAVEPOINT_RUNNER,
    AFTER_COMMIT_TASK_REGISTRY,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof ConvertMemoToTodos>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof ConvertMemoToTodos>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ConvertMemoToTodos>[0]["mutationLock"],
    todoCreator: ConstructorParameters<typeof ConvertMemoToTodos>[0]["todoCreator"],
    savepointRunner: ConstructorParameters<typeof ConvertMemoToTodos>[0]["savepointRunner"],
    afterCommit: ConstructorParameters<typeof ConvertMemoToTodos>[0]["afterCommit"],
  ) =>
    new ConvertMemoToTodos({
      repository,
      unitOfWork,
      mutationLock,
      todoCreator,
      savepointRunner,
      afterCommit,
      logger: new Logger(ConvertMemoToTodos.name),
    }),
};

export const createMemoProvider: FactoryProvider<CreateMemo> = {
  provide: CreateMemo,
  inject: [MEMO_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    repository: ConstructorParameters<typeof CreateMemo>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof CreateMemo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof CreateMemo>[0]["mutationLock"],
  ) =>
    new CreateMemo({ repository, unitOfWork, mutationLock, logger: new Logger(CreateMemo.name) }),
};

export const deleteMemoProvider: FactoryProvider<DeleteMemo> = {
  provide: DeleteMemo,
  inject: [MEMO_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    repository: ConstructorParameters<typeof DeleteMemo>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof DeleteMemo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteMemo>[0]["mutationLock"],
  ) =>
    new DeleteMemo({ repository, unitOfWork, mutationLock, logger: new Logger(DeleteMemo.name) }),
};

export const reorderMemoProvider: FactoryProvider<ReorderMemo> = {
  provide: ReorderMemo,
  inject: [MEMO_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    repository: ConstructorParameters<typeof ReorderMemo>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof ReorderMemo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderMemo>[0]["mutationLock"],
  ) =>
    new ReorderMemo({ repository, unitOfWork, mutationLock, logger: new Logger(ReorderMemo.name) }),
};

export const toggleMemoPinProvider: FactoryProvider<ToggleMemoPin> = {
  provide: ToggleMemoPin,
  inject: [MEMO_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    repository: ConstructorParameters<typeof ToggleMemoPin>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof ToggleMemoPin>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ToggleMemoPin>[0]["mutationLock"],
  ) =>
    new ToggleMemoPin({
      repository,
      unitOfWork,
      mutationLock,
      logger: new Logger(ToggleMemoPin.name),
    }),
};

export const updateMemoProvider: FactoryProvider<UpdateMemo> = {
  provide: UpdateMemo,
  inject: [MEMO_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    repository: ConstructorParameters<typeof UpdateMemo>[0]["repository"],
    unitOfWork: ConstructorParameters<typeof UpdateMemo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateMemo>[0]["mutationLock"],
  ) =>
    new UpdateMemo({ repository, unitOfWork, mutationLock, logger: new Logger(UpdateMemo.name) }),
};
