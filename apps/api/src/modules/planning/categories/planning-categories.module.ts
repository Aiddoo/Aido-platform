import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";

import { PlanningTodoRemovalModule } from "../todos/planning-todo-removal.module.js";
import { TodoCategoryCountReaderPort } from "./application/ports/todo-category-count.reader.port.js";
import { TodoCategoryProvisionerPort } from "./application/ports/todo-category-provisioner.port.js";
import { TodoCategoryReaderPort } from "./application/ports/todo-category.reader.port.js";
import { PLANNING_CATEGORIES_PROVIDERS } from "./planning-categories.providers.js";
import { TodoCategoryController } from "./presentation/http/v1/todo-category.controller.js";

@Module({
  imports: [AccessFeatureGrantsQueriesModule, PlanningTodoRemovalModule],
  controllers: [TodoCategoryController],
  providers: [...PLANNING_CATEGORIES_PROVIDERS],
  exports: [TodoCategoryReaderPort, TodoCategoryCountReaderPort, TodoCategoryProvisionerPort],
})
export class PlanningCategoriesModule {}
