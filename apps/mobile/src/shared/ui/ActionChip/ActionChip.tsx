import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { PressableFeedback } from 'heroui-native';
import type { ReactNode } from 'react';

import { Text } from '../Text';

const ICON_SIZE = fontScaledSize(16, 0.3);

interface ActionChipProps {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onPress: () => void;
}

export const ActionChip = ({ icon, label, isActive = false, onPress }: ActionChipProps) => {
  return (
    <PressableFeedback
      onPress={onPress}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        isActive ? 'border-main/30 bg-main/10' : 'border-gray-3',
      )}
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
};

export type { ActionChipProps };
export { ICON_SIZE as ACTION_CHIP_ICON_SIZE };
