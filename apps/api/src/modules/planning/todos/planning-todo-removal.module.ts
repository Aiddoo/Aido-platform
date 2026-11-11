import { Module } from "@nestjs/common";

import { NotificationRemindersModule } from "#api/modules/notification/notification-reminders.public";
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";

import { TodoBulkRemoverPort } from "./application/ports/todo-bulk-remover.port.js";
import { TodoCachePort } from "./application/ports/todo-cache.port.js";
import { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
import { RemoveCategoryTodosUseCase } from "./application/use-cases/remove-category-todos.use-case.js";
import { TodoCacheAdapter } from "./infrastructure/adapters/todo-cache.adapter.js";
import { ReminderSchedulerAdapter } from "./infrastructure/adapters/todo-reminder-scheduler.adapter.js";
import { DrizzleTodoBulkRemoverAdapter } from "./infrastructure/persistence/drizzle-todo-bulk-remover.adapter.js";

// 카테고리 slice가 안의 할 일을 함께 지우거나 친구 화면 캐시를 지울 때 쓴다. PlanningTodoPortsModule이 카테고리 Module을 import하므로 그 아래층에 따로 둔다
@Module({
  imports: [NotificationRemindersModule],
  providers: [
    { provide: TodoBulkRemoverPort, useClass: DrizzleTodoBulkRemoverAdapter },
    { provide: TodoReminderSchedulerPort, useClass: ReminderSchedulerAdapter },
    { provide: TodoCachePort, useClass: TodoCacheAdapter },
    provideUseCase(RemoveCategoryTodosUseCase, {
      bulkRemover: TodoBulkRemoverPort,
      reminderScheduler: TodoReminderSchedulerPort,
      todoCache: TodoCachePort,
      afterCommit: AfterCommitTaskRegistryPort,
    }),
  ],
  exports: [RemoveCategoryTodosUseCase, TodoCachePort],
})
export class PlanningTodoRemovalModule {}
