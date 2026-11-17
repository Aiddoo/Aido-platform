import { Module } from "@nestjs/common";

import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { NotificationRemindersModule } from "#api/modules/notification/reminders/notification-reminders.public";
import { PlanningTodoCategoriesQueriesModule } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";

import { CategoryOwnershipPort } from "./application/ports/category-ownership.port.js";
import { TodoCachePort } from "./application/ports/todo-cache.port.js";
import { TodoOwnerTimezonePort } from "./application/ports/todo-owner-timezone.port.js";
import { TodoReadRepositoryPort } from "./application/ports/todo-read.repository.port.js";
import { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
import { TodoRepositoryPort } from "./application/ports/todo.repository.port.js";
import { ApplyTodoEventsUseCase } from "./application/use-cases/apply-todo-events.use-case.js";
import { ResolveTodoTimezoneUseCase } from "./application/use-cases/resolve-todo-timezone.use-case.js";
import { CategoryOwnershipAdapter } from "./infrastructure/adapters/category-ownership.adapter.js";
import { TodoCacheAdapter } from "./infrastructure/adapters/todo-cache.adapter.js";
import { TodoOwnerTimezoneAdapter } from "./infrastructure/adapters/todo-owner-timezone.adapter.js";
import { ReminderSchedulerAdapter } from "./infrastructure/adapters/todo-reminder-scheduler.adapter.js";
import { DrizzleTodoReadRepository } from "./infrastructure/persistence/drizzle-todo-read.repository.js";
import { DrizzleTodoRepository } from "./infrastructure/persistence/drizzle-todo.repository.js";

// todos와 todo-series가 함께 쓰는 할 일 저장·캐시·리마인더 포트다. 할 일 기능 Module이 반복 Module을 import하므로
// 반복 Module이 할 일 기능 Module을 import하면 순환이 된다. 그래서 두 Module 아래층에 둔다
@Module({
  imports: [
    PlanningTodoCategoriesQueriesModule,
    NotificationRemindersModule,
    IdentitySettingsModule,
  ],
  providers: [
    { provide: TodoRepositoryPort, useClass: DrizzleTodoRepository },
    { provide: TodoReadRepositoryPort, useClass: DrizzleTodoReadRepository },
    { provide: TodoCachePort, useClass: TodoCacheAdapter },
    { provide: TodoReminderSchedulerPort, useClass: ReminderSchedulerAdapter },
    { provide: CategoryOwnershipPort, useClass: CategoryOwnershipAdapter },
    { provide: TodoOwnerTimezonePort, useClass: TodoOwnerTimezoneAdapter },
    provideUseCase(ResolveTodoTimezoneUseCase, { ownerTimezone: TodoOwnerTimezonePort }),
    provideUseCase(ApplyTodoEventsUseCase, {
      reminderScheduler: TodoReminderSchedulerPort,
      eventPublisher: DomainEventPublisherPort,
      clock: ClockPort,
    }),
  ],
  exports: [
    TodoRepositoryPort,
    TodoReadRepositoryPort,
    TodoCachePort,
    TodoReminderSchedulerPort,
    CategoryOwnershipPort,
    TodoOwnerTimezonePort,
    ResolveTodoTimezoneUseCase,
    ApplyTodoEventsUseCase,
  ],
})
export class PlanningTodoPortsModule {}
