import { Text } from '@src/shared/ui';
import { ControlField } from 'heroui-native';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

interface SettingsToggleProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  label: string;
  description?: string;
}

export function SettingsToggle({ label, description, ...controlProps }: SettingsToggleProps) {
  return (
    <ControlField {...controlProps}>
      <View className="flex-1">
        <Text size="b2" shade={8}>
          {label}
        </Text>
        {description && (
          <Text size="b3" shade={6}>
            {description}
          </Text>
        )}
      </View>
      <ControlField.Indicator />
    </ControlField>
  );
}
