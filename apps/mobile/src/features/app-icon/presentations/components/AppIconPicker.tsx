import { useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  CrownIcon,
  Grid,
  GridItem,
  Result,
  type QueryErrorFallbackProps,
  Text,
  VStack,
} from '@src/shared/ui';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import type { AppIconKey } from '../../models/app-icon.model';
import { APP_ICONS } from '../constants/app-icons.constant';

interface AppIconPickerProps extends Omit<ComponentProps<typeof Grid>, 'children'> {
  value: string | null;
  onChange: (value: AppIconKey) => void;
  isDisabled?: boolean;
  isLocked?: (key: AppIconKey) => boolean;
}

export function AppIconPicker({
  value,
  onChange,
  isDisabled,
  isLocked,
  ...props
}: AppIconPickerProps) {
  return (
    <Grid columns={3} {...props}>
      {APP_ICONS.map((icon) => (
        <GridItem key={icon.key} p={8} className="items-center">
          <AppIconPicker.Item
            icon={icon}
            isSelected={icon.key === (value ?? 'default')}
            isLocked={isLocked?.(icon.key)}
            isDisabled={isDisabled}
            onPress={() => onChange(icon.key)}
          />
        </GridItem>
      ))}
    </Grid>
  );
}

interface AppIconPickerItemProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children'
> {
  icon: (typeof APP_ICONS)[number];
  isSelected: boolean;
  isLocked?: boolean;
}

AppIconPicker.Item = function Item({
  icon,
  isSelected,
  isLocked,
  ...props
}: AppIconPickerItemProps) {
  const { t } = useTranslation('appIcon');
  const label = t(icon.labelKey);
  return (
    <PressableFeedback
      className="rounded-2xl overflow-visible"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled: props.isDisabled }}
      {...props}
    >
      <VStack align="center" gap={8} p={8} className="overflow-visible">
        <View>
          <Avatar isSelected={isSelected} alt={label} className="w-20 h-20 rounded-2xl">
            <Avatar.Image source={icon.preview} />
          </Avatar>
          {isLocked && (
            <View className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-8 dark:bg-gray-2 dark:border-gray-4 border-gray-8 border items-center justify-center z-10">
              <CrownIcon width={14} height={14} />
            </View>
          )}
        </View>
        <Text
          size="b4"
          weight={isSelected ? 'semibold' : 'normal'}
          shade={isSelected ? 9 : 6}
          numberOfLines={1}
        >
          {label}
        </Text>
      </VStack>
      <PressableFeedback.Highlight className="rounded-2xl" />
    </PressableFeedback>
  );
};

AppIconPicker.Loading = function Loading() {
  return (
    <Grid columns={3} className="p-4">
      {Array.from({ length: 9 }, (_, index) => (
        <GridItem key={index} p={8} className="items-center">
          <VStack align="center" gap={8} p={8}>
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <Skeleton className="w-16 h-4 rounded" />
          </VStack>
        </GridItem>
      ))}
    </Grid>
  );
};

AppIconPicker.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['appIcon', 'common']);
  return (
    <Result
      title={t('errorDialog.title')}
      description={t('errorDialog.description')}
      button={<Result.Button onPress={reset}>{t('common:errorBoundary.retry')}</Result.Button>}
    />
  );
};
