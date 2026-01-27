import type { CreateTodoInput, GetTodosQuery, ToggleTodoCompleteInput } from '@aido/validators';

import type { AiUsage, ParsedTodoResult, TodoItem, TodosResult } from '../models/todo.model';
import type { TodoRepository } from '../repositories/todo.repository';
import { toAiUsage, toParsedTodoResult, toTodoItem, toTodoItems } from './todo.mapper';

export class TodoService {
  constructor(private readonly _todoRepository: TodoRepository) {}

  getTodos = async (params: GetTodosQuery): Promise<TodosResult> => {
    const response = await this._todoRepository.getTodos(params);

    return {
      todos: toTodoItems(response.items),
      hasNext: response.pagination.hasNext,
      nextCursor: response.pagination.nextCursor,
    };
  };

  toggleTodoComplete = async (todoId: number, body: ToggleTodoCompleteInput): Promise<TodoItem> => {
    const todo = await this._todoRepository.toggleTodoComplete(todoId, body);
    return toTodoItem(todo);
  };

  createTodo = async (params: CreateTodoInput): Promise<TodoItem> => {
    const todo = await this._todoRepository.createTodo(params);
    return toTodoItem(todo);
  };

  parseTodo = async (text: string): Promise<ParsedTodoResult> => {
    const response = await this._todoRepository.parseTodo(text);
    return toParsedTodoResult(response);
  };

  getAiUsage = async (): Promise<AiUsage> => {
    const response = await this._todoRepository.getAiUsage();
    return toAiUsage(response);
  };
}
