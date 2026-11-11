import { useAccountSyncStorage, useSyncStorage } from '@src/shared/di/shared-di-context';
import { useMemo, useSyncExternalStore } from 'react';
import { match } from 'ts-pattern';

import {
  createStoredValueSource,
  resolveStoredValueKey,
  type StoredValueDefinition,
  type StoredValueScope,
} from './define-stored-value';

/** 핸들러·effect에서 `readStoredValue`·`writeStoredValue`로 읽고 쓸 때 그 정의의 저장소를 꺼낸다 */
export function useStoredValueStorage<TValue, TScope>({
  area,
}: StoredValueDefinition<TValue, TScope>) {
  const deviceStorage = useSyncStorage();
  const accountStorage = useAccountSyncStorage();

  return match(area)
    .with('device', () => deviceStorage)
    .with('account', () => accountStorage)
    .exhaustive();
}

/** 기기 저장 값을 구독하는 `[value, setValue]`. 범위 값인데 범위가 없으면 fallback과 아무것도 하지 않는 세터다 */
export function useStoredValue<TValue, TScope = never>(
  definition: StoredValueDefinition<TValue, TScope>,
  ...scope: StoredValueScope<TScope>
) {
  const storage = useStoredValueStorage(definition);
  const key = resolveStoredValueKey(definition, ...scope);
  const source = useMemo(
    () => createStoredValueSource(storage, definition, key),
    [storage, definition, key],
  );
  const value = useSyncExternalStore(source.subscribe, source.getSnapshot);

  return [value, source.setValue] as const;
}
