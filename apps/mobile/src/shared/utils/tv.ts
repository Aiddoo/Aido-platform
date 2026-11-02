import { createTV } from 'tailwind-variants';

import { TAILWIND_MERGE_CONFIG } from './tailwind-merge-config';

/** 커스텀 유틸리티(text-display·text-b1 등)를 색상 클래스와 다른 그룹으로 병합한다. 규칙은 `cn`과 공유한다. */
export const tv = createTV({ twMergeConfig: TAILWIND_MERGE_CONFIG });
