import { Injectable } from '@nestjs/common';
import type { Todo } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Todo[]> {
    return this.prisma.todo.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: number): Promise<Todo | null> {
    return this.prisma.todo.findUnique({ where: { id } });
  }

  async create(data: { title: string; content?: string }): Promise<Todo> {
    return this.prisma.todo.create({ data });
  }

  async update(id: number, data: Partial<Todo>): Promise<Todo> {
    return this.prisma.todo.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Todo> {
    return this.prisma.todo.delete({ where: { id } });
  }
}
