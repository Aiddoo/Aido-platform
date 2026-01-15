/**
 * Todo Response DTOs for NestJS
 */
import { createZodDto } from 'nestjs-zod';
import { todoSchema } from '../../../domains/todo/todo.response';

export class TodoDto extends createZodDto(todoSchema) {}
