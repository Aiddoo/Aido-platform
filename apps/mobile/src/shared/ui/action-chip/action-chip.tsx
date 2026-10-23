import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import { Text } from '../text';

function useActionChipIconSize(): number {
  const fontScaledSize = useFontScaledSize();

  return fontScaledSize(16, 0.3);
}

interface ActionChipProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onPress?: PressableProps['onPress'];
}

export function ActionChip({
  icon,
  label,
  isActive = false,
  className,
  ...props
}: ActionChipProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        isActive ? 'border-main/30 bg-main/10' : 'border-gray-3',
        className,
      )}
      {...props}
    >
      {icon}
      <Text
        size="e1"
        weight="medium"
        {...(isActive ? { tone: 'brand' as const } : { shade: 6 as const })}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}

export type { ActionChipProps };
export { useActionChipIconSize };
