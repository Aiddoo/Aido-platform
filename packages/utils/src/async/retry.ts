/**
 * 비동기 유틸리티
 * @packageDocumentation
 */

/**
 * 디바운스된 함수 생성
 *
 * @param fn - 디바운스할 함수
 * @param ms - 대기 시간 (밀리초)
 * @returns 디바운스된 함수
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * debouncedSearch('h');
 * debouncedSearch('he');
 * debouncedSearch('hel'); // 300ms 후 'hel'로만 실행됨
 * ```
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * 쓰로틀된 함수 생성
 *
 * @param fn - 쓰로틀할 함수
 * @param ms - 최소 실행 간격 (밀리초)
 * @returns 쓰로틀된 함수
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolled!');
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
