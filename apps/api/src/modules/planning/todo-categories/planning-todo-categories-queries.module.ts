import { Module } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { TodoCategoryCountReaderPort } from "./application/ports/todo-category-count.reader.port.js";
import { TodoCategoryProvisionerPort } from "./application/ports/todo-category-provisioner.port.js";
import { TodoCategoryReaderPort } from "./application/ports/todo-category.reader.port.js";
import { TodoCategoryRepositoryPort } from "./application/ports/todo-category.repository.port.js";
import { DefaultTodoCategoryProvisionerAdapter } from "./infrastructure/adapters/default-todo-category-provisioner.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";
import { DrizzleTodoCategoryRepository } from "./infrastructure/persistence/drizzle-todo-category.repository.js";

// 다른 Context와 todos가 카테고리를 읽는 포트만 두고 다른 Module을 import하지 않는다.
// 가입 트랜잭션의 기본 카테고리 만들기도 여기 둔다. 카테고리 기능 Module은 할 일 기능 Module을 import해 identity가 쓰면 순환이 된다
@Module({
  providers: [
    { provide: TodoCategoryRepositoryPort, useClass: DrizzleTodoCategoryRepository },
    provideUseCase(TodoCategoryReaderAdapter, { repository: TodoCategoryRepositoryPort }),
    { provide: TodoCategoryReaderPort, useExisting: TodoCategoryReaderAdapter },
    { provide: TodoCategoryCountReaderPort, useExisting: TodoCategoryReaderAdapter },
    { provide: TodoCategoryProvisionerPort, useClass: DefaultTodoCategoryProvisionerAdapter },
  ],
  exports: [TodoCategoryReaderPort, TodoCategoryCountReaderPort, TodoCategoryProvisionerPort],
})
export class PlanningTodoCategoriesQueriesModule {}
