import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUsersQueriesModule } from "#api/modules/identity/users/identity-users.public";

import { PlanningTodoPortsModule } from "../todos/planning-todo-ports.module.js";
import { TodoSeriesRepositoryPort } from "./application/ports/todo-series.repository.port.js";
import { ApplyFollowingTodosUpdateUseCase } from "./application/use-cases/apply-following-todos-update.use-case.js";
import { CatchUpTodoSeriesUseCase } from "./application/use-cases/catch-up-todo-series.use-case.js";
import { CheckTodoSeriesStartUseCase } from "./application/use-cases/check-todo-series-start.use-case.js";
import { DeleteTodoOccurrencesUseCase } from "./application/use-cases/delete-todo-occurrences.use-case.js";
import { MaterializeTodoOccurrencesUseCase } from "./application/use-cases/materialize-todo-occurrences.use-case.js";
import { PublishFollowingTodosUpdateUseCase } from "./application/use-cases/publish-following-todos-update.use-case.js";
import { PublishTodoSeriesEditUseCase } from "./application/use-cases/publish-todo-series-edit.use-case.js";
import { PublishTodoSeriesStartedUseCase } from "./application/use-cases/publish-todo-series-started.use-case.js";
import { PublishTodoSeriesStoppedUseCase } from "./application/use-cases/publish-todo-series-stopped.use-case.js";
import { StartSeriesFromTodoUseCase } from "./application/use-cases/start-series-from-todo.use-case.js";
import { StopTodoSeriesUseCase } from "./application/use-cases/stop-todo-series.use-case.js";
import { UpdateFollowingTodosUseCase } from "./application/use-cases/update-following-todos.use-case.js";
import { PLANNING_TODO_SERIES_PROVIDERS } from "./planning-todo-series.providers.js";
import { TodoSeriesController } from "./presentation/http/v1/todo-series.controller.js";

@Module({
  imports: [PlanningTodoPortsModule, AccessFeatureGrantsQueriesModule, IdentityUsersQueriesModule],
  controllers: [TodoSeriesController],
  providers: [...PLANNING_TODO_SERIES_PROVIDERS],
  exports: [
    TodoSeriesRepositoryPort,
    MaterializeTodoOccurrencesUseCase,
    PublishTodoSeriesStartedUseCase,
    PublishTodoSeriesEditUseCase,
    CatchUpTodoSeriesUseCase,
    DeleteTodoOccurrencesUseCase,
    CheckTodoSeriesStartUseCase,
    StartSeriesFromTodoUseCase,
    StopTodoSeriesUseCase,
    PublishTodoSeriesStoppedUseCase,
    ApplyFollowingTodosUpdateUseCase,
    PublishFollowingTodosUpdateUseCase,
    UpdateFollowingTodosUseCase,
  ],
})
export class PlanningTodoSeriesModule {}
