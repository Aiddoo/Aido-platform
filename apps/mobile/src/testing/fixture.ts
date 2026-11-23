import { cloneDeep } from 'es-toolkit';
import type { z } from 'zod';

/** 기본값을 스키마로 한 번 검증해 두고, 호출마다 덮어쓸 필드만 받는다. 모델이 바뀌어 어긋난 기본값은 만드는 순간 실패한다 */
export function defineFixture<TSchema extends z.ZodType<object>>(
  schema: TSchema,
  defaults: z.input<TSchema>,
) {
  const base: z.output<TSchema> = schema.parse(defaults);

  // 기본값을 매번 복사해 한 테스트가 고친 중첩 값(dto.data.todos)이 다른 테스트로 새지 않게 한다
  return (overrides: Partial<z.output<TSchema>> = {}): z.output<TSchema> => ({
    ...cloneDeep(base),
    ...overrides,
  });
}
