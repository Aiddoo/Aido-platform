/**
 * Todo Request DTOs for NestJS
 */
import { createZodDto } from 'nestjs-zod';
import { todoCreateSchema, todoUpdateSchema } from '../../../domains/todo/todo.request';

export class TodoCreateDto extends createZodDto(todoCreateSchema) {}

export class TodoUpdateDto extends createZodDto(todoUpdateSchema) {}
