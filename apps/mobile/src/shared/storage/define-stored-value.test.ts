import { createMemorySyncStorage } from '@src/shared/__tests__';
import { z } from 'zod';

import {
  defineStoredValue,
  readStoredValue,
  storedJsonSchema,
  writeStoredValue,
} from './define-stored-value';

const viewModeStoredValue = defineStoredValue({
  key: 'aido_test_view_mode_v1',
  schema: z.enum(['week', 'month']),
  fallback: 'week',
});

const settingsStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_test_settings_v1:${accountId}`,
  schema: storedJsonSchema(z.object({ isCompact: z.boolean() })),
  fallback: null,
  // 1.0은 불리언 하나를 원문 그대로 남겼다
  migrate: (raw) => (raw === 'compact' ? { isCompact: true } : null),
});

describe('readStoredValue', () => {
  it.each([
    ['JSON이 아니다', '{isCompact'],
    ['모양이 다르다', '{"isCompact":"yes"}'],
  ])('원문이 깨졌으면(%s) fallback으로 읽는다', (_case, raw) => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_test_settings_v1:account-1', raw);

    // When
    const value = readStoredValue(storage, settingsStoredValue, 'account-1');

    // Then
    expect(value).toBeNull();
  });

  it('저장소가 읽다가 던져도 fallback으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.get.mockImplementation(() => {
      throw new Error('mmkv unavailable');
    });

    // When
    const value = readStoredValue(storage, viewModeStoredValue);

    // Then
    expect(value).toBe('week');
  });

  it('지금 스키마로 못 읽는 옛 원문은 migrate로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_test_settings_v1:account-1', 'compact');

    // When
    const value = readStoredValue(storage, settingsStoredValue, 'account-1');

    // Then
    expect(value).toEqual({ isCompact: true });
  });

  it('범위 값인데 범위가 없으면 저장소를 보지 않고 fallback이다', () => {
    // Given
    const storage = createMemorySyncStorage();

    // When
    const value = readStoredValue(storage, settingsStoredValue, undefined);

    // Then
    expect(value).toBeNull();
    expect(storage.get).not.toHaveBeenCalled();
  });
});

describe('writeStoredValue', () => {
  it('문자열 값은 원문 그대로, 그 밖의 값은 JSON으로 남긴다', () => {
    // Given
    const storage = createMemorySyncStorage();

    // When
    writeStoredValue(storage, viewModeStoredValue, 'month');
    writeStoredValue(storage, settingsStoredValue, { isCompact: false }, 'account-1');

    // Then
    expect(storage.get('aido_test_view_mode_v1')).toBe('month');
    expect(storage.get('aido_test_settings_v1:account-1')).toBe('{"isCompact":false}');
  });

  it('null을 쓰면 키를 지운다', () => {
    // Given
    const storage = createMemorySyncStorage();
    writeStoredValue(storage, settingsStoredValue, { isCompact: true }, 'account-1');

    // When
    writeStoredValue(storage, settingsStoredValue, null, 'account-1');

    // Then
    expect(storage.get('aido_test_settings_v1:account-1')).toBeUndefined();
  });

  it('범위가 없으면 쓰지 않는다', () => {
    // Given
    const storage = createMemorySyncStorage();

    // When
    writeStoredValue(storage, settingsStoredValue, { isCompact: true }, null);

    // Then
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe('storedJsonSchema', () => {
  it('변환이 있는 스키마의 값도 JSON으로 남기고 다시 읽는다', () => {
    // Given
    const inviteStoredValue = defineStoredValue({
      key: 'aido_test_invite_v1',
      schema: storedJsonSchema(z.object({ code: z.string().transform((code) => code.trim()) })),
      fallback: null,
    });
    const storage = createMemorySyncStorage();

    // When
    writeStoredValue(storage, inviteStoredValue, { code: 'K7M2QX' });

    // Then
    expect(storage.get('aido_test_invite_v1')).toBe('{"code":"K7M2QX"}');
    expect(readStoredValue(storage, inviteStoredValue)).toEqual({ code: 'K7M2QX' });
  });

  it('정수는 String(n)으로 남긴 옛 원문과 같은 원문으로 읽고 쓴다', () => {
    // Given
    const countStoredValue = defineStoredValue({
      key: 'aido_test_count_v1',
      schema: storedJsonSchema(z.int().nonnegative()),
      fallback: 0,
    });
    const storage = createMemorySyncStorage();
    storage.set('aido_test_count_v1', String(3));

    // When
    const value = readStoredValue(storage, countStoredValue);
    writeStoredValue(storage, countStoredValue, value + 1);

    // Then
    expect(value).toBe(3);
    expect(storage.get('aido_test_count_v1')).toBe(String(4));
  });
});
