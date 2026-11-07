import { useSyncExternalStore } from 'react';

/**
 * jest 환경용 react-native-mmkv(v4 · Nitro) 목.
 *
 * v4는 import 시 `react-native-nitro-modules`가 NitroModules TurboModule을 eager 로드하는데,
 * jest(네이티브 바이너리 없음)에서는 이 로드가 크래시한다. 실제 저장 동작은 각 테스트가
 * `SyncStorage` 포트를 주입(`createMemorySyncStorage`)해 대체하므로, 여기서는 import 크래시를
 * 막고 모듈 로드 시점의 `createMMKV()` 호출만 안전하게 처리하는 인메모리 목을 제공한다.
 */
class InMemoryMMKV {
  readonly #store = new Map<string, string>();
  readonly #listeners = new Set<(key: string) => void>();

  #notify(key: string): void {
    this.#listeners.forEach((listener) => listener(key));
  }

  addOnValueChangedListener(listener: (key: string) => void): { remove: () => void } {
    this.#listeners.add(listener);
    return { remove: () => this.#listeners.delete(listener) };
  }

  getString(key: string): string | undefined {
    return this.#store.get(key);
  }

  set(key: string, value: string | number | boolean): void {
    this.#store.set(key, String(value));
    this.#notify(key);
  }

  remove(key: string): boolean {
    const removed = this.#store.delete(key);
    this.#notify(key);
    return removed;
  }

  clearAll(): void {
    this.#store.clear();
  }

  contains(key: string): boolean {
    return this.#store.has(key);
  }

  getAllKeys(): string[] {
    return [...this.#store.keys()];
  }
}

export const createMMKV = (): InMemoryMMKV => new InMemoryMMKV();

export function useMMKVString(key: string, instance: InMemoryMMKV) {
  const value = useSyncExternalStore(
    (onChange) => {
      const subscription = instance.addOnValueChangedListener((changedKey) => {
        if (changedKey === key) {
          onChange();
        }
      });
      return subscription.remove;
    },
    () => instance.getString(key),
  );

  return [value, (next: string) => instance.set(key, next)] as const;
}

export const MMKV = InMemoryMMKV;
export const existsMMKV = (): boolean => false;
export const deleteMMKV = (): boolean => false;
