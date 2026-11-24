import type { Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import {
  TodoCategoryCreatorPort,
  TodoCategoryReaderPort,
} from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import {
  ResolveTodoTimezoneUseCase,
  TodoCategoryUsageReaderPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoImportItemRepositoryPort } from "./application/ports/todo-import-item.repository.port.js";
import { TodoImportLinkRepositoryPort } from "./application/ports/todo-import-link.repository.port.js";
import { TodoImportMaterializationQueuePort } from "./application/ports/todo-import-materialization-queue.port.js";
import { TodoImportUndoQueuePort } from "./application/ports/todo-import-undo-queue.port.js";
import { TodoImportRepositoryPort } from "./application/ports/todo-import.repository.port.js";
import { AssertTodoImportTargetsUseCase } from "./application/use-cases/assert-todo-import-targets.use-case.js";
import { CancelTodoImportUseCase } from "./application/use-cases/cancel-todo-import.use-case.js";
import { CommitTodoImportUseCase } from "./application/use-cases/commit-todo-import.use-case.js";
import { FindActiveTodoImportUseCase } from "./application/use-cases/find-active-todo-import.use-case.js";
import { GetTodoImportUseCase } from "./application/use-cases/get-todo-import.use-case.js";
import { ReceiveTodoImportItemsUseCase } from "./application/use-cases/receive-todo-import-items.use-case.js";
import { RequestTodoImportUndoUseCase } from "./application/use-cases/request-todo-import-undo.use-case.js";
import { StartTodoImportUseCase } from "./application/use-cases/start-todo-import.use-case.js";
import { TodoImportMaterializationQueueAdapter } from "./infrastructure/jobs/todo-import-materialization-queue.adapter.js";
import { TodoImportUndoQueueAdapter } from "./infrastructure/jobs/todo-import-undo-queue.adapter.js";
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
    categoryUsageReader: TodoCategoryUsageReaderPort,
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
] satisfies Provider[];
