import { useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  Box,
  CrownIcon,
  Grid,
  GridItem,
  QueryErrorActions,
  type QueryErrorFallbackProps,
  Result,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { range } from 'es-toolkit';
import { RadioGroup, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';

import { APP_ICONS } from '../constants/app-icon.constants';
import type { AppIconKey } from '../schemas/app-icon.schema';

interface AppIconPickerProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
> {
  /** 아이콘 키가 아닌 값(프로필 사진 주소 등)이면 아무것도 선택되지 않는다 */
  value: string | null;
  onValueChange: (value: AppIconKey) => void;
  isLocked?: (key: AppIconKey) => boolean;
}

export function AppIconPicker({ value, onValueChange, isLocked, ...props }: AppIconPickerProps) {
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
          <GridItem key={icon.key} p={8} className="items-center">
            <AppIconPicker.Item icon={icon} isLocked={isLocked?.(icon.key)} />
          </GridItem>
        ))}
      </Grid>
    </RadioGroup>
  );
}

interface AppIconPickerItemProps extends Omit<
  ComponentProps<typeof RadioGroup.Item>,
  'children' | 'value'
> {
  icon: (typeof APP_ICONS)[number];
  isLocked?: boolean;
}

AppIconPicker.Item = function Item({ icon, isLocked, ...props }: AppIconPickerItemProps) {
  const { t } = useTranslation('appIcon');
  const label = t(icon.labelKey);

  return (
    <RadioGroup.Item
      value={icon.key}
      className="rounded-2xl overflow-visible active:opacity-70"
      accessibilityLabel={label}
      {...props}
    >
      {({ isSelected }) => (
        <VStack align="center" gap={8} p={8} className="overflow-visible">
          <Box>
            <Avatar isSelected={isSelected} alt={label} className="w-20 h-20 rounded-2xl">
              <Avatar.Image source={icon.preview} />
            </Avatar>
            {isLocked && (
              <Box className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-8 dark:bg-gray-2 dark:border-gray-4 border-gray-8 border items-center justify-center z-10">
                <CrownIcon width={14} height={14} />
              </Box>
            )}
          </Box>
          <Text
            size="b4"
            weight={isSelected ? 'semibold' : 'normal'}
            shade={isSelected ? 9 : 6}
            maxLines={1}
          >
            {label}
          </Text>
        </VStack>
      )}
    </RadioGroup.Item>
  );
};

AppIconPicker.Loading = function Loading() {
  return (
    <Grid columns={3}>
      {range(APP_ICONS.length).map((index) => (
        <GridItem key={index} p={8} className="items-center">
          <VStack align="center" gap={8} p={8}>
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <TextSkeleton size="b4" className="w-16" />
          </VStack>
        </GridItem>
      ))}
    </Grid>
  );
};

AppIconPicker.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['appIcon', 'common']);
  return (
    <Result
      title={t('errorDialog.title')}
      description={t('errorDialog.description')}
      button={<QueryErrorActions onRetry={reset} />}
    />
  );
};
