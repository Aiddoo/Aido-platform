import type { CreateTodoInput } from '@aido/validators';

import type { TodoCountByDate, TodoItem, TodosResult } from '../models/todo.model';
import type {
  GetTodoCountsParams,
  GetTodosParams,
  TodoRepository,
  ToggleTodoCompleteParams,
} from '../repositories/todo.repository';
import { toTodoItem, toTodoItems } from './todo.mapper';

export class TodoService {
  constructor(private readonly _todoRepository: TodoRepository) {}

  getTodos = async (params: GetTodosParams): Promise<TodosResult> => {
    const response = await this._todoRepository.getTodos(params);

    return {
      todos: toTodoItems(response.items),
      hasNext: response.pagination.hasNext,
      nextCursor: response.pagination.nextCursor,
    };
  };

  getTodoCounts = async (params: GetTodoCountsParams): Promise<TodoCountByDate> => {
    const response = await this._todoRepository.getTodoCounts(params);
    return response.counts;
  };

  toggleTodoComplete = async (params: ToggleTodoCompleteParams): Promise<TodoItem> => {
    const todo = await this._todoRepository.toggleTodoComplete(params);
    return toTodoItem(todo);
  };

  createTodo = async (params: CreateTodoInput): Promise<TodoItem> => {
    const todo = await this._todoRepository.createTodo(params);
    return toTodoItem(todo);
  };
}
