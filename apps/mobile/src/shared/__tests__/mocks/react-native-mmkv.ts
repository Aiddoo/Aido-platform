/**
 * jest 환경용 react-native-mmkv(v4 · Nitro) 목.
 *
 * v4는 import 시 `react-native-nitro-modules`가 NitroModules TurboModule을 eager 로드하는데,
 * jest(네이티브 바이너리 없음)에서는 이 로드가 크래시한다. 실제 저장 동작은 각 테스트가
 * `SyncStorage` 포트를 주입(`createMockSyncStorage`)해 대체하므로, 여기서는 import 크래시를
 * 막고 모듈 로드 시점의 `createMMKV()` 호출만 안전하게 처리하는 인메모리 목을 제공한다.
 */
class InMemoryMMKV {
  readonly #store = new Map<string, string>();

  getString(key: string): string | undefined {
    return this.#store.get(key);
  }

  set(key: string, value: string | number | boolean): void {
    this.#store.set(key, String(value));
  }

  remove(key: string): boolean {
    return this.#store.delete(key);
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
export const MMKV = InMemoryMMKV;
