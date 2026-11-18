import { Module } from "@nestjs/common";

import { PlanningTodoCategoriesModule } from "./todo-categories/planning-todo-categories.module.js";
import { PlanningTodoSeriesModule } from "./todo-series/planning-todo-series.module.js";
import { PlanningTodosModule } from "./todos/planning-todos.module.js";

@Module({
  imports: [PlanningTodoCategoriesModule, PlanningTodoSeriesModule, PlanningTodosModule],
  exports: [PlanningTodoCategoriesModule, PlanningTodoSeriesModule, PlanningTodosModule],
})
export class PlanningModule {}
