import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

export interface IconButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityRole' | 'accessibilityLabel'
> {
  icon: ReactNode;
  /** 글자가 없는 버튼이라 스크린 리더가 읽을 이름이 필수다 */
  accessibilityLabel: string;
}

/**
 * 아이콘만 있는 버튼. 눌리는 영역은 최소 44pt이다.
 * 더 작은 모양이 필요하면 `min-h-*`/`min-w-*`를 줄이고 `hitSlop`으로 44를 채운다.
 */
export function IconButton({ icon, accessibilityLabel, className, ...props }: IconButtonProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn('min-h-11 min-w-11 items-center justify-center', className)}
      {...props}
    >
      {icon}
    </PressableFeedback>
  );
}
