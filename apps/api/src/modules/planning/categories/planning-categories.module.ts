import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import { TodoCategoryCountReaderPort } from "./application/ports/todo-category-count.reader.port.js";
import { TodoCategoryProvisionerPort } from "./application/ports/todo-category-provisioner.port.js";
import { TodoCategoryReaderPort } from "./application/ports/todo-category.reader.port.js";
import { PLANNING_CATEGORIES_PROVIDERS } from "./planning-categories.providers.js";
import { TodoCategoryController } from "./presentation/http/v1/todo-category.controller.js";

@Module({
  imports: [AccessModule],
  controllers: [TodoCategoryController],
  providers: [...PLANNING_CATEGORIES_PROVIDERS],
  exports: [TodoCategoryReaderPort, TodoCategoryCountReaderPort, TodoCategoryProvisionerPort],
})
export class PlanningCategoriesModule {}
