import { todoSchema } from '@aido/validators';
import { createZodDto } from 'nestjs-zod';

/**
 * Todo 응답 스키마
 *
 * @description
 * 스키마는 @aido/validators 패키지에서 import하여 Frontend와 공유합니다.
 * Prisma에서 반환하는 Date 객체는 직렬화 시 자동으로 ISO 문자열로 변환됩니다.
 */
export { todoSchema as TodoSchema } from '@aido/validators';

export class TodoResponseDto extends createZodDto(todoSchema) {}
