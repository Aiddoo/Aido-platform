import { z } from 'zod';

import { cursorPageSchema } from './cursor-page.model';

describe('cursorPageSchema', () => {
  it('마지막 쪽은 nextCursor null로 받는다', () => {
    // Given
    const schema = cursorPageSchema(z.object({ id: z.int() }), z.int());

    // When
    const page = schema.parse({ items: [{ id: 1 }], nextCursor: null });

    // Then
    expect(page).toEqual({ items: [{ id: 1 }], nextCursor: null });
  });

  it('nextCursor가 빠진 쪽은 받지 않는다', () => {
    // Given
    const schema = cursorPageSchema(z.object({ id: z.int() }), z.int());

    // When
    const result = schema.safeParse({ items: [] });

    // Then
    expect(result.success).toBe(false);
  });
});
