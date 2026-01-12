import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTodoDto } from './dto/create-todo.dto';
import type { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoRepository } from './todo.repository';

@Injectable()
export class TodoService {
  constructor(private readonly todoRepository: TodoRepository) {}

  async findAll() {
    return this.todoRepository.findAll();
  }

  async findById(id: number) {
    const todo = await this.todoRepository.findById(id);
    if (!todo) throw new NotFoundException(`Todo #${id} not found`);
    return todo;
  }

  async create(dto: CreateTodoDto) {
    return this.todoRepository.create(dto);
  }

  async update(id: number, dto: UpdateTodoDto) {
    await this.findById(id);
    return this.todoRepository.update(id, dto);
  }

  async delete(id: number) {
    await this.findById(id);
    return this.todoRepository.delete(id);
  }
}
