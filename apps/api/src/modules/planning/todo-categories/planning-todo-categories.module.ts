import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { PlanningTodoCategoriesQueriesModule } from "./planning-todo-categories-queries.module.js";
import { PLANNING_TODO_CATEGORIES_PROVIDERS } from "./planning-todo-categories.providers.js";
import { TodoCategoryController } from "./presentation/http/v1/todo-category.controller.js";

@Module({
  imports: [
    AccessFeatureGrantsQueriesModule,
    PlanningTodosModule,
    PlanningTodoCategoriesQueriesModule,
  ],
  controllers: [TodoCategoryController],
  providers: [...PLANNING_TODO_CATEGORIES_PROVIDERS],
})
export class PlanningTodoCategoriesModule {}
