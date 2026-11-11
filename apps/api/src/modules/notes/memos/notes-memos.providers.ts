import type { Provider } from "@nestjs/common";

import { StagedTodoCreatorPort } from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { SavepointRunnerPort } from "#api/shared/application/ports/savepoint-runner.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { MemoRepositoryPort } from "./application/ports/memo.repository.port.js";
import { PlanMemoWriterPort } from "./application/ports/plan-memo-writer.port.js";
import { ConvertMemoToTodoUseCase } from "./application/use-cases/convert-memo-to-todo.use-case.js";
import { ConvertMemoToTodosUseCase } from "./application/use-cases/convert-memo-to-todos.use-case.js";
import { CreateMemoUseCase } from "./application/use-cases/create-memo.use-case.js";
import { DeleteMemoUseCase } from "./application/use-cases/delete-memo.use-case.js";
import { GetMemoResourceLimitUseCase } from "./application/use-cases/get-memo-resource-limit.use-case.js";
import { GetMemoUseCase } from "./application/use-cases/get-memo.use-case.js";
import { ListMemosUseCase } from "./application/use-cases/list-memos.use-case.js";
import { ReorderMemoUseCase } from "./application/use-cases/reorder-memo.use-case.js";
import { SetMemoPinnedUseCase } from "./application/use-cases/set-memo-pinned.use-case.js";
import { UpdateMemoUseCase } from "./application/use-cases/update-memo.use-case.js";
import { PlanMemoWriterAdapter } from "./infrastructure/adapters/plan-memo-writer.adapter.js";
import { DrizzleMemoRepository } from "./infrastructure/persistence/drizzle-memo.repository.js";

export const NOTES_MEMOS_PROVIDERS = [
  { provide: MemoRepositoryPort, useClass: DrizzleMemoRepository },
  { provide: PlanMemoWriterPort, useClass: PlanMemoWriterAdapter },
  provideUseCase(CreateMemoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(CreateMemoUseCase),
  }),
  provideUseCase(UpdateMemoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(UpdateMemoUseCase),
  }),
  provideUseCase(SetMemoPinnedUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(SetMemoPinnedUseCase),
  }),
  provideUseCase(ReorderMemoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(ReorderMemoUseCase),
  }),
  provideUseCase(DeleteMemoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    memoRepository: MemoRepositoryPort,
    logger: loggerFor(DeleteMemoUseCase),
  }),
  provideUseCase(GetMemoUseCase, { memoRepository: MemoRepositoryPort }),
  provideUseCase(ListMemosUseCase, { memoRepository: MemoRepositoryPort }),
  provideUseCase(GetMemoResourceLimitUseCase, { memoRepository: MemoRepositoryPort }),
  provideUseCase(ConvertMemoToTodoUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    afterCommit: AfterCommitTaskRegistryPort,
    memoRepository: MemoRepositoryPort,
    todoCreator: StagedTodoCreatorPort,
    logger: loggerFor(ConvertMemoToTodoUseCase),
  }),
  provideUseCase(ConvertMemoToTodosUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    savepointRunner: SavepointRunnerPort,
    afterCommit: AfterCommitTaskRegistryPort,
    memoRepository: MemoRepositoryPort,
    todoCreator: StagedTodoCreatorPort,
    logger: loggerFor(ConvertMemoToTodosUseCase),
  }),
] satisfies Provider[];
