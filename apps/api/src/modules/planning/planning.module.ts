import { Module } from "@nestjs/common";

import { PlanningCategoriesModule } from "./categories/planning-categories.module.js";
import { PlanningTodoSeriesModule } from "./todo-series/planning-todo-series.module.js";
import { PlanningTodosModule } from "./todos/planning-todos.module.js";

@Module({
  imports: [PlanningCategoriesModule, PlanningTodoSeriesModule, PlanningTodosModule],
  exports: [PlanningCategoriesModule, PlanningTodoSeriesModule, PlanningTodosModule],
})
export class PlanningModule {}
