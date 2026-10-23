import { cn } from '@src/shared/utils/cn';

import { Box } from '../box/box';
import type { ReadableContentProps } from './readable-content.types';

export const READABLE_CONTENT_MAX_WIDTH = 480;

/**
 * 넓은 창(iPhone Duo 내부 화면, 폴더블 펼침, 태블릿)에서 내용을 가운데 최대 폭으로 모은다.
 * 배경은 부모가 창 전체에 깔고, 일반 폰에서는 창 폭이 더 좁아 레이아웃이 바뀌지 않는다.
 */
export function ReadableContent({ className, style, ...props }: ReadableContentProps) {
  return (
    <Box
      className={cn('w-full self-center', className)}
      style={[{ maxWidth: READABLE_CONTENT_MAX_WIDTH }, style]}
      {...props}
    />
  );
}
