import { z } from 'zod';

import { readQueryKeyParams } from './query-key-params';

const paramsSchema = z.object({ locationRevision: z.number() });

describe('readQueryKeyParams', () => {
  it('키의 깊이와 무관하게 마지막 객체를 읽는다', () => {
    // Given
    const shallow = ['weather', { locationRevision: 1 }];
    const deep = ['weather', 'report', 'v2', { locationRevision: 2 }];

    // When
    const results = [shallow, deep].map((key) => readQueryKeyParams(key, paramsSchema));

    // Then
    expect(results).toEqual([{ locationRevision: 1 }, { locationRevision: 2 }]);
  });

  it('마지막이 인자가 아니면 null이다', () => {
    // Given
    const prefixKey = ['weather', 'report'];

    // When
    const params = readQueryKeyParams(prefixKey, paramsSchema);

    // Then
    expect(params).toBeNull();
  });

  it('모양이 다른 인자는 null이다', () => {
    // Given
    const key = ['weather', 'report', { locationRevision: '1' }];

    // When
    const params = readQueryKeyParams(key, paramsSchema);

    // Then
    expect(params).toBeNull();
  });

  it('빈 키는 null이다', () => {
    // When
    const params = readQueryKeyParams([], paramsSchema);

    // Then
    expect(params).toBeNull();
  });
});
