import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 병합 유틸리티
 *
 * - clsx: 조건부 클래스 처리
 * - twMerge: Tailwind 클래스 충돌 해결 (마지막 클래스 우선)
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-2가 px-4로 덮어씌워짐)
 * cn('text-red-500', condition && 'text-blue-500') // 조건부 적용
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
