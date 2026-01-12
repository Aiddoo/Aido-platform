import { todoCreateSchema } from '@aido/validators';
import { createZodDto } from 'nestjs-zod';

// 스키마는 @aido/validators에서 import
export { todoCreateSchema as CreateTodoSchema } from '@aido/validators';

export class CreateTodoDto extends createZodDto(todoCreateSchema) {}
