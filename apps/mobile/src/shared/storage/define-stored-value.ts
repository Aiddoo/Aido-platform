import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { noop } from 'es-toolkit';
import { z } from 'zod';

/** `device`는 기기 저장소, `account`는 로그아웃 때 통째로 비우는 암호화 저장소다 */
type StoredValueArea = 'device' | 'account';

/** 범위 키면 범위(계정 id 등)를 받는다. 범위가 없으면(로그인 전) fallback으로 읽고 쓰지 않는다 */
export type StoredValueScope<TScope> = [TScope] extends [never]
  ? []
  : [scope: TScope | null | undefined];

export interface StoredValueDefinition<TValue, TScope = never> {
  /** 범위 값이면 범위로 키를 만든다(`aido_{feature}_{name}_v{n}:{accountId}`) */
  readonly key: string | ((scope: TScope) => string);
  readonly area: StoredValueArea;
  /** 원문 문자열 → 값. 원문이 JSON이면 `storedJsonSchema`로 감싼다 */
  readonly schema: z.ZodType<NonNullable<TValue>, string>;
  /** 값이 없거나 읽지 못하면 이 값이다 */
  readonly fallback: TValue;
  /** 지금 스키마로 읽지 못한 원문을 옛 모양으로 읽는다. 못 읽으면 null */
  readonly migrate?: (raw: string) => NonNullable<TValue> | null;
}

/** 원문은 문자열이고 값은 null이 아니다. 없음은 `fallback: null`로 나타낸다 */
type StoredValueSchema = z.ZodType<{}, string>;

interface StoredValueOptions<TSchema extends StoredValueSchema, TScope, TFallback> {
  key: string | ((scope: TScope) => string);
  area?: StoredValueArea;
  schema: TSchema;
  fallback: TFallback;
  migrate?: (raw: string) => z.output<TSchema> | null;
}

/** 기기에 남기는 값 하나의 키·모양·기본값. `fallback: null`이면 값이 없을 때 null로 읽는다 */
export function defineStoredValue<TSchema extends StoredValueSchema, TScope = never>(
  options: StoredValueOptions<TSchema, TScope, null>,
): StoredValueDefinition<z.output<TSchema> | null, TScope>;
export function defineStoredValue<TSchema extends StoredValueSchema, TScope = never>(
  options: StoredValueOptions<TSchema, TScope, NoInfer<z.output<TSchema>>>,
): StoredValueDefinition<z.output<TSchema>, TScope>;
export function defineStoredValue({
  area = 'device',
  ...options
}: StoredValueOptions<StoredValueSchema, never, unknown>): StoredValueDefinition<unknown, never> {
  return { ...options, area };
}

/**
 * 원문이 JSON인 값의 스키마. 문자열 값은 원문 그대로 남으므로 받지 않는다.
 * 정수는 `String(n)`과 같은 원문이다
 */
export function storedJsonSchema<TSchema extends z.ZodType<object | number | boolean>>(
  schema: TSchema,
) {
  return z
    .string()
    .transform((raw, context): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        context.issues.push({ code: 'custom', message: 'Invalid stored JSON', input: raw });
        return z.NEVER;
      }
    })
    .pipe(schema);
}

function resolveKey<TScope>(
  key: StoredValueDefinition<unknown, TScope>['key'],
  scope: readonly [] | readonly [TScope | null | undefined],
): string | null {
  if (typeof key === 'string') {
    return key;
  }
  const scopeValue = scope.at(0);
  return scopeValue == null ? null : key(scopeValue);
}

function readRaw(storage: SyncStorage, key: string) {
  try {
    return storage.get(key);
  } catch {
    return undefined;
  }
}

function decode<TValue, TScope>(
  definition: StoredValueDefinition<TValue, TScope>,
  raw: string | undefined,
): TValue {
  if (raw == null) {
    return definition.fallback;
  }
  try {
    const decoded = definition.schema.safeParse(raw);
    if (decoded.success) {
      return decoded.data;
    }
    return definition.migrate?.(raw) ?? definition.fallback;
  } catch {
    return definition.fallback;
  }
}

// 문자열 값은 원문 그대로, 그 밖의 값은 JSON으로 쓴다. 스키마의 변환은 되돌리지 않는다. null은 지운다
function write<TValue>(storage: SyncStorage, key: string | null, value: TValue) {
  if (key == null) {
    return;
  }
  try {
    if (value == null) {
      storage.remove(key);
      return;
    }
    storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // 쓰지 못하면 다음에 한 번 더 묻거나 보일 뿐이라 흐름을 막지 않는다
  }
}

/** 던지지 않는다. 깨진 값은 fallback이다 */
export function readStoredValue<TValue, TScope>(
  storage: SyncStorage,
  definition: StoredValueDefinition<TValue, TScope>,
  ...scope: StoredValueScope<TScope>
): TValue {
  const key = resolveKey(definition.key, scope);
  return key == null ? definition.fallback : decode(definition, readRaw(storage, key));
}

export function writeStoredValue<TValue, TScope>(
  storage: SyncStorage,
  definition: StoredValueDefinition<TValue, TScope>,
  value: NoInfer<TValue>,
  ...scope: StoredValueScope<TScope>
): void {
  write(storage, resolveKey(definition.key, scope), value);
}

/** 로그아웃·탈퇴 정리가 실패를 기록하도록 지우기 실패는 그대로 던진다 */
export function removeStoredValue<TValue, TScope>(
  storage: SyncStorage,
  definition: StoredValueDefinition<TValue, TScope>,
  ...scope: StoredValueScope<TScope>
): void {
  const key = resolveKey(definition.key, scope);
  if (key != null) {
    storage.remove(key);
  }
}

export function resolveStoredValueKey<TValue, TScope>(
  definition: StoredValueDefinition<TValue, TScope>,
  ...scope: StoredValueScope<TScope>
): string | null {
  return resolveKey(definition.key, scope);
}

/**
 * `useSyncExternalStore`에 넘길 구독·스냅숏과 세터. `key`는 `resolveStoredValueKey`로 만든다.
 * 원문이 같으면 다시 읽지 않고 같은 값(참조)을 돌려준다. 키가 null이면 fallback이고 구독·쓰기를 하지 않는다
 */
export function createStoredValueSource<TValue, TScope>(
  storage: ObservableSyncStorage,
  definition: StoredValueDefinition<TValue, TScope>,
  key: string | null,
) {
  let snapshot: { raw: string | undefined; value: TValue } | null = null;

  return {
    subscribe: (onChange: () => void) => (key == null ? noop : storage.subscribe(key, onChange)),
    getSnapshot: (): TValue => {
      if (key == null) {
        return definition.fallback;
      }
      const raw = readRaw(storage, key);
      if (snapshot == null || snapshot.raw !== raw) {
        snapshot = { raw, value: decode(definition, raw) };
      }
      return snapshot.value;
    },
    setValue: (value: TValue) => write(storage, key, value),
  };
}
