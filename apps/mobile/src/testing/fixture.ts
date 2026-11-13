import type { z } from 'zod';

/** 기본값을 스키마로 한 번 검증해 두고, 호출마다 덮어쓸 필드만 받는다. 모델이 바뀌어 어긋난 기본값은 만드는 순간 실패한다 */
export function defineFixture<TSchema extends z.ZodType>(
  schema: TSchema,
  defaults: z.input<TSchema>,
) {
  const base: z.output<TSchema> = schema.parse(defaults);

  return (overrides: Partial<z.output<TSchema>> = {}): z.output<TSchema> =>
    Object.assign({}, base, overrides);
}
