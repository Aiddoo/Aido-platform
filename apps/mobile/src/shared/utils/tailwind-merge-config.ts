import type { ConfigExtension } from 'tailwind-merge';

/** text-* 접두사를 쓰는 커스텀 유틸리티가 색상 클래스와 충돌하지 않도록 따로 묶는다. */
const customClassGroups = {
  'text-input': [
    'text-input-display',
    'text-input-h1',
    'text-input-t1',
    'text-input-t2',
    'text-input-t3',
    'text-input-b1',
    'text-input-b2',
    'text-input-b3',
    'text-input-b4',
    'text-input-e1',
    'text-input-e2',
  ],
  'text-size': [
    'text-display',
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

export type CustomClassGroupIds = keyof typeof customClassGroups;

/** `cn`과 `tv`가 같은 충돌 규칙으로 병합하도록 한 곳에서 정의한다. */
export const TAILWIND_MERGE_CONFIG = {
  extend: {
    classGroups: customClassGroups,
  },
} satisfies ConfigExtension<CustomClassGroupIds, string>;
