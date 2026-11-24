import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { PlanningTodoCategoriesQueriesModule } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

// 카테고리 기능 Module은 public으로 열면 할 일 public과 파일 순환이 생겨 같은 Context 안 경로로 붙인다
import { PlanningTodoCategoriesModule } from "../todo-categories/planning-todo-categories.module.js";
import { PLANNING_TODO_IMPORTS_PROVIDERS } from "./planning-todo-imports.providers.js";
import { TodoImportController } from "./presentation/http/v1/todo-import.controller.js";

@Module({
  imports: [
    AccessFeatureGrantsQueriesModule,
    PlanningTodosModule,
    PlanningTodoCategoriesModule,
    PlanningTodoCategoriesQueriesModule,
  ],
  controllers: [TodoImportController],
  providers: [...PLANNING_TODO_IMPORTS_PROVIDERS],
})
export class PlanningTodoImportsModule {}
