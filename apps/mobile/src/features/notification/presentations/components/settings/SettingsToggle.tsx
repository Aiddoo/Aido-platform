import { ControlField, Description, Label } from 'heroui-native';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

interface SettingsToggleProps
  extends Pick<
    ComponentProps<typeof ControlField>,
    'isSelected' | 'onSelectedChange' | 'isDisabled'
  > {
  label: string;
  description?: string;
}

export function SettingsToggle({
  label,
  description,
  isSelected,
  onSelectedChange,
  isDisabled,
}: SettingsToggleProps) {
  return (
    <ControlField
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
      isDisabled={isDisabled}
    >
      <View className="flex-1">
        <Label>{label}</Label>
        {description && <Description>{description}</Description>}
      </View>
      <ControlField.Indicator />
    </ControlField>
  );
}
