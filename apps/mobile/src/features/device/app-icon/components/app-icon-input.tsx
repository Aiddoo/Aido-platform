import { useTranslation } from '@src/shared/i18n';
import { Avatar, Grid, GridItem, Text, VStack } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import { APP_ICONS } from '../constants/app-icon.constants';
import type { AppIconKey } from '../domains/app-icon.model';

interface AppIconInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
> {
  /** 아이콘 키가 아닌 값(프로필 사진 주소 등)이면 아무것도 선택되지 않는다 */
  value: string | null;
  onValueChange: (value: AppIconKey) => void;
}

export function AppIconInput({ value, onValueChange, ...props }: AppIconInputProps) {
  return (
    <RadioGroup
      value={value ?? 'default'}
      onValueChange={(next) => {
        const icon = APP_ICONS.find(({ key }) => key === next);
        if (icon != null) {
          onValueChange(icon.key);
        }
      }}
      {...props}
    >
      <Grid columns={3}>
        {APP_ICONS.map((icon) => (
          <GridItem key={icon.key} className="items-center p-2">
            <AppIconInput.Item icon={icon} />
          </GridItem>
        ))}
      </Grid>
    </RadioGroup>
  );
}

interface AppIconInputItemProps extends Omit<
  ComponentProps<typeof RadioGroup.Item>,
  'children' | 'value'
> {
  icon: (typeof APP_ICONS)[number];
}

AppIconInput.Item = function Item({ icon, ...props }: AppIconInputItemProps) {
  const { t } = useTranslation('appIcon');
  const label = t(icon.labelKey);

  return (
    <RadioGroup.Item
      value={icon.key}
      className="overflow-visible rounded-2xl active:opacity-70"
      accessibilityLabel={label}
      {...props}
    >
      {({ isSelected }) => (
        <VStack align="center" gap={8} className="overflow-visible p-2">
          <Avatar isSelected={isSelected} alt={label} className="h-20 w-20 rounded-2xl">
            <Avatar.Image source={icon.preview} />
          </Avatar>
          <Text
            size="b4"
            weight={isSelected ? 'semibold' : 'normal'}
            shade={isSelected ? 9 : 6}
            numberOfLines={1}
          >
            {label}
          </Text>
        </VStack>
      )}
    </RadioGroup.Item>
  );
};
