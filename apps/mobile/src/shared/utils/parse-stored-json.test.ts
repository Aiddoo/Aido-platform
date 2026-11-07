import { z } from 'zod';

import { parseStoredJson } from './parse-stored-json';

const schema = z.object({ count: z.number() });

describe('parseStoredJson', () => {
  it('스키마에 맞는 JSON이면 값을 반환한다', () => {
    // Given
    const raw = JSON.stringify({ count: 3 });

    // When
    const result = parseStoredJson(raw, schema);

    // Then
    expect(result).toEqual({ count: 3 });
  });

  it('저장된 값이 없으면 null을 반환한다', () => {
    // When
    const result = parseStoredJson(undefined, schema);

    // Then
    expect(result).toBeNull();
  });

  it('JSON이 깨졌으면 던지지 않고 null을 반환한다', () => {
    // Given
    const raw = '{count:';

    // When
    const result = parseStoredJson(raw, schema);

    // Then
    expect(result).toBeNull();
  });

  it('스키마와 다른 모양이면 null을 반환한다', () => {
    // Given
    const raw = JSON.stringify({ count: '3' });

    // When
    const result = parseStoredJson(raw, schema);

    // Then
    expect(result).toBeNull();
  });
});
