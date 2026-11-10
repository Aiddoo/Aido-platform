import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import {
  TODO_CATEGORY_COUNT_READER,
  TodoCategoryCountReaderPort,
} from "./application/ports/todo-category-count.reader.port.js";
import {
  TODO_CATEGORY_PROVISIONER,
  TodoCategoryProvisionerPort,
} from "./application/ports/todo-category-provisioner.port.js";
import {
  TODO_CATEGORY_READER,
  TodoCategoryReaderPort,
} from "./application/ports/todo-category.reader.port.js";
import { PLANNING_CATEGORIES_PROVIDERS } from "./planning-categories.providers.js";
import { TodoCategoryController } from "./presentation/http/v1/todo-category.controller.js";

@Module({
  imports: [AccessModule],
  controllers: [TodoCategoryController],
  providers: [...PLANNING_CATEGORIES_PROVIDERS],
  exports: [
    TodoCategoryReaderPort,
    TodoCategoryCountReaderPort,
    TodoCategoryProvisionerPort,
    TODO_CATEGORY_READER,
    TODO_CATEGORY_COUNT_READER,
    TODO_CATEGORY_PROVISIONER,
  ],
})
export class PlanningCategoriesModule {}
