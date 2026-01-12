import { todoUpdateSchema } from '@aido/validators';
import { createZodDto } from 'nestjs-zod';

// 스키마는 @aido/validators에서 import
export { todoUpdateSchema as UpdateTodoSchema } from '@aido/validators';

export class UpdateTodoDto extends createZodDto(todoUpdateSchema) {}
