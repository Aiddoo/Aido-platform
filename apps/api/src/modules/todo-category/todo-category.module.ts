import { Module } from "@nestjs/common";

import { UserRegisteredCategoryListener } from "./listeners/user-registered-category.listener";
import { TodoCategoryController } from "./todo-category.controller";
import { TodoCategoryRepository } from "./todo-category.repository";
import { TodoCategoryService } from "./todo-category.service";

@Module({
	controllers: [TodoCategoryController],
	providers: [
		TodoCategoryService,
		TodoCategoryRepository,
		UserRegisteredCategoryListener,
	],
	exports: [TodoCategoryService, TodoCategoryRepository],
})
export class TodoCategoryModule {}
