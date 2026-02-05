import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * 커스텀 Tailwind 클래스 그룹 설정
 * text-* 접두사를 사용하는 커스텀 유틸리티가 색상 클래스와 충돌하지 않도록 분리
 */
const customClassGroups = {
  'text-input': ['text-input-sm', 'text-input-md', 'text-input-lg'],
  'text-size': [
    'text-h1',
    'text-t1',
    'text-t2',
    'text-t3',
    'text-b1',
    'text-b2',
    'text-b3',
    'text-b4',
    'text-e1',
    'text-e2',
  ],
} as const;

type CustomClassGroupIds = keyof typeof customClassGroups;

const customTwMerge = extendTailwindMerge<CustomClassGroupIds>({
  extend: {
    classGroups: customClassGroups,
  },
});

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
  return customTwMerge(clsx(inputs));
}
