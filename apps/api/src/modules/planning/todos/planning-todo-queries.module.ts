import { Module } from "@nestjs/common";

import { RepeatingTodoTitleReaderPort } from "./application/ports/repeating-todo-title.reader.port.js";
import { SingleTodoCountReaderPort } from "./application/ports/single-todo-count.reader.port.js";
import { TodoCompletionGroupReaderPort } from "./application/ports/todo-completion-group.reader.port.js";
import { TodoDetailsReaderPort } from "./application/ports/todo-details.reader.port.js";
import { TodoScheduleReaderPort } from "./application/ports/todo-schedule.reader.port.js";
import { DrizzleRepeatingTodoTitleReader } from "./infrastructure/persistence/drizzle-repeating-todo-title.reader.js";
import { DrizzleSingleTodoCountReader } from "./infrastructure/persistence/drizzle-single-todo-count.reader.js";
import { DrizzleTodoCompletionGroupReader } from "./infrastructure/persistence/drizzle-todo-completion-group.reader.js";
import { DrizzleTodoDetailsReader } from "./infrastructure/persistence/drizzle-todo-details.reader.js";
import { DrizzleTodoScheduleReader } from "./infrastructure/persistence/drizzle-todo-schedule.reader.js";

// 다른 Context가 할 일을 읽는 조회 포트만 둔다. notification·weather가 import해도 순환이 없게 다른 Module을 import하지 않는다
@Module({
  providers: [
    { provide: TodoCompletionGroupReaderPort, useClass: DrizzleTodoCompletionGroupReader },
    { provide: TodoScheduleReaderPort, useClass: DrizzleTodoScheduleReader },
    { provide: TodoDetailsReaderPort, useClass: DrizzleTodoDetailsReader },
    { provide: RepeatingTodoTitleReaderPort, useClass: DrizzleRepeatingTodoTitleReader },
    { provide: SingleTodoCountReaderPort, useClass: DrizzleSingleTodoCountReader },
  ],
  exports: [
    TodoCompletionGroupReaderPort,
    TodoScheduleReaderPort,
    TodoDetailsReaderPort,
    RepeatingTodoTitleReaderPort,
    SingleTodoCountReaderPort,
  ],
})
export class PlanningTodoQueriesModule {}
