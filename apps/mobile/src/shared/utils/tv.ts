import { createTV } from 'tailwind-variants';

/**
 * 커스텀 tailwind-variants 설정
 *
 * twMerge에서 커스텀 유틸리티 클래스 충돌 방지
 * - text-input-* 는 text-gray-* 와 다른 그룹으로 처리
 */
export const tv = createTV({
  twMergeConfig: {
    extend: {
      classGroups: {
        // 커스텀 유틸리티 추가 시 여기에 등록
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
      },
    },
  },
});
