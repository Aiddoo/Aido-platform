import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";

import { PlanningTodoPortsModule } from "../todos/planning-todo-ports.module.js";
import { TodoSeriesRepositoryPort } from "./application/ports/todo-series.repository.port.js";
import { CatchUpTodoSeriesUseCase } from "./application/use-cases/catch-up-todo-series.use-case.js";
import { MaterializeTodoOccurrencesUseCase } from "./application/use-cases/materialize-todo-occurrences.use-case.js";
import { PublishTodoCreationUseCase } from "./application/use-cases/publish-todo-creation.use-case.js";
import { PublishTodoSeriesEditUseCase } from "./application/use-cases/publish-todo-series-edit.use-case.js";
import { StartSeriesFromTodoUseCase } from "./application/use-cases/start-series-from-todo.use-case.js";
import { StopTodoSeriesUseCase } from "./application/use-cases/stop-todo-series.use-case.js";
import { UpdateFollowingTodosUseCase } from "./application/use-cases/update-following-todos.use-case.js";
import { PLANNING_TODO_SERIES_PROVIDERS } from "./planning-todo-series.providers.js";
import { TodoSeriesController } from "./presentation/http/v1/todo-series.controller.js";

@Module({
  imports: [PlanningTodoPortsModule, AccessEntitlementsModule, IdentityUserAccessModule],
  controllers: [TodoSeriesController],
  providers: [...PLANNING_TODO_SERIES_PROVIDERS],
  exports: [
    TodoSeriesRepositoryPort,
    MaterializeTodoOccurrencesUseCase,
    PublishTodoCreationUseCase,
    PublishTodoSeriesEditUseCase,
    CatchUpTodoSeriesUseCase,
    StartSeriesFromTodoUseCase,
    StopTodoSeriesUseCase,
    UpdateFollowingTodosUseCase,
  ],
})
export class PlanningTodoSeriesModule {}
