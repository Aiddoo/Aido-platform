import type { Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import {
  TodoCategoryCreatorPort,
  TodoCategoryReaderPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import {
  RemoveTodosUseCase,
  ResolveTodoTimezoneUseCase,
  StagedTodoBatchCreatorPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoImportItemRepositoryPort } from "./application/ports/todo-import-item.repository.port.js";
import { TodoImportLinkRepositoryPort } from "./application/ports/todo-import-link.repository.port.js";
import { TodoImportMaterializationQueuePort } from "./application/ports/todo-import-materialization-queue.port.js";
import { TodoImportUndoQueuePort } from "./application/ports/todo-import-undo-queue.port.js";
import { TodoImportRepositoryPort } from "./application/ports/todo-import.repository.port.js";
import { AssertTodoImportTargetsUseCase } from "./application/use-cases/assert-todo-import-targets.use-case.js";
import { CancelTodoImportUseCase } from "./application/use-cases/cancel-todo-import.use-case.js";
import { CommitTodoImportUseCase } from "./application/use-cases/commit-todo-import.use-case.js";
import { FailTodoImportUseCase } from "./application/use-cases/fail-todo-import.use-case.js";
import { FindActiveTodoImportUseCase } from "./application/use-cases/find-active-todo-import.use-case.js";
import { GetTodoImportUseCase } from "./application/use-cases/get-todo-import.use-case.js";
import { MaterializeTodoImportUseCase } from "./application/use-cases/materialize-todo-import.use-case.js";
import { PurgeTodoImportsUseCase } from "./application/use-cases/purge-todo-imports.use-case.js";
import { ReceiveTodoImportItemsUseCase } from "./application/use-cases/receive-todo-import-items.use-case.js";
import { ReconcileTodoImportsUseCase } from "./application/use-cases/reconcile-todo-imports.use-case.js";
import { RequestTodoImportUndoUseCase } from "./application/use-cases/request-todo-import-undo.use-case.js";
import { StartTodoImportUseCase } from "./application/use-cases/start-todo-import.use-case.js";
import { UndoTodoImportUseCase } from "./application/use-cases/undo-todo-import.use-case.js";
import { TodoImportCleanupProcessor } from "./infrastructure/jobs/todo-import-cleanup.processor.js";
import { TodoImportCleanupScheduler } from "./infrastructure/jobs/todo-import-cleanup.scheduler.js";
import { TodoImportMaterializationQueueAdapter } from "./infrastructure/jobs/todo-import-materialization-queue.adapter.js";
import { TodoImportMaterializationProcessor } from "./infrastructure/jobs/todo-import-materialization.processor.js";
import { TodoImportReconcileProcessor } from "./infrastructure/jobs/todo-import-reconcile.processor.js";
import { TodoImportReconcileScheduler } from "./infrastructure/jobs/todo-import-reconcile.scheduler.js";
import { TodoImportUndoQueueAdapter } from "./infrastructure/jobs/todo-import-undo-queue.adapter.js";
import { TodoImportUndoProcessor } from "./infrastructure/jobs/todo-import-undo.processor.js";
import { DrizzleTodoImportItemRepository } from "./infrastructure/persistence/drizzle-todo-import-item.repository.js";
import { DrizzleTodoImportLinkRepository } from "./infrastructure/persistence/drizzle-todo-import-link.repository.js";
import { DrizzleTodoImportRepository } from "./infrastructure/persistence/drizzle-todo-import.repository.js";

const MUTATION = {
  unitOfWork: UnitOfWorkPort,
  mutationLock: MutationLockPort,
} as const;

export const PLANNING_TODO_IMPORTS_PROVIDERS = [
  { provide: TodoImportRepositoryPort, useClass: DrizzleTodoImportRepository },
  { provide: TodoImportItemRepositoryPort, useClass: DrizzleTodoImportItemRepository },
  { provide: TodoImportLinkRepositoryPort, useClass: DrizzleTodoImportLinkRepository },
  { provide: TodoImportMaterializationQueuePort, useClass: TodoImportMaterializationQueueAdapter },
  { provide: TodoImportUndoQueuePort, useClass: TodoImportUndoQueueAdapter },
  provideUseCase(AssertTodoImportTargetsUseCase, {
    categoryReader: TodoCategoryReaderPort,
    categoryCreator: TodoCategoryCreatorPort,
    entitlementReader: EntitlementReaderPort,
  }),
  provideUseCase(StartTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    timezoneResolver: ResolveTodoTimezoneUseCase,
    entitlementReader: EntitlementReaderPort,
    assertTargets: AssertTodoImportTargetsUseCase,
    clock: ClockPort,
    logger: loggerFor(StartTodoImportUseCase),
  }),
  provideUseCase(ReceiveTodoImportItemsUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    itemRepository: TodoImportItemRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(CommitTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    entitlementReader: EntitlementReaderPort,
    assertTargets: AssertTodoImportTargetsUseCase,
    categoryCreator: TodoCategoryCreatorPort,
    materializationQueue: TodoImportMaterializationQueuePort,
    clock: ClockPort,
    logger: loggerFor(CommitTodoImportUseCase),
  }),
  provideUseCase(GetTodoImportUseCase, {
    todoImportRepository: TodoImportRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(FindActiveTodoImportUseCase, {
    todoImportRepository: TodoImportRepositoryPort,
    clock: ClockPort,
  }),
  provideUseCase(CancelTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    itemRepository: TodoImportItemRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(CancelTodoImportUseCase),
  }),
  provideUseCase(RequestTodoImportUndoUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    undoQueue: TodoImportUndoQueuePort,
    clock: ClockPort,
    logger: loggerFor(RequestTodoImportUndoUseCase),
  }),
  provideUseCase(MaterializeTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    itemRepository: TodoImportItemRepositoryPort,
    linkRepository: TodoImportLinkRepositoryPort,
    batchCreator: StagedTodoBatchCreatorPort,
    afterCommit: AfterCommitTaskRegistryPort,
    materializationQueue: TodoImportMaterializationQueuePort,
    clock: ClockPort,
    logger: loggerFor(MaterializeTodoImportUseCase),
  }),
  provideUseCase(UndoTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    linkRepository: TodoImportLinkRepositoryPort,
    removeTodos: RemoveTodosUseCase,
    undoQueue: TodoImportUndoQueuePort,
    clock: ClockPort,
    logger: loggerFor(UndoTodoImportUseCase),
  }),
  provideUseCase(FailTodoImportUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(FailTodoImportUseCase),
  }),
  provideUseCase(ReconcileTodoImportsUseCase, {
    ...MUTATION,
    todoImportRepository: TodoImportRepositoryPort,
    itemRepository: TodoImportItemRepositoryPort,
    materializationQueue: TodoImportMaterializationQueuePort,
    undoQueue: TodoImportUndoQueuePort,
    alert: OperationalAlertPort,
    clock: ClockPort,
    logger: loggerFor(ReconcileTodoImportsUseCase),
  }),
  provideUseCase(PurgeTodoImportsUseCase, {
    unitOfWork: UnitOfWorkPort,
    todoImportRepository: TodoImportRepositoryPort,
    itemRepository: TodoImportItemRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(PurgeTodoImportsUseCase),
  }),
  TodoImportMaterializationProcessor,
  TodoImportUndoProcessor,
  TodoImportReconcileProcessor,
  TodoImportReconcileScheduler,
  TodoImportCleanupProcessor,
  TodoImportCleanupScheduler,
] satisfies Provider[];
