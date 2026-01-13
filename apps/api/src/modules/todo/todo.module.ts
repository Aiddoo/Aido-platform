import { Module } from "@nestjs/common";
import { TodoController } from "./todo.controller";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";

@Module({
	controllers: [TodoController],
	providers: [TodoService, TodoRepository],
	exports: [TodoService],
})
export class TodoModule {}
