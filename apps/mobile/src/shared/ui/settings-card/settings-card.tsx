import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { ControlField, ListGroup, Separator, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { Box } from '../box';
import { HStack } from '../h-stack';
import { ArrowRightIcon } from '../icon';
import { QueryErrorActions, type QueryErrorFallbackProps } from '../query-error-boundary';
import { ReadableContent } from '../readable-content';
import { Result } from '../result';
import { StyledSafeAreaView } from '../styled-safe-area-view';
import { Text, TextSkeleton } from '../text';
import { VStack } from '../v-stack';

export interface SettingsCardProps extends ComponentProps<typeof ListGroup> {
  label?: string;
}

export function SettingsCard({ label, className, children, ...props }: SettingsCardProps) {
  return (
    <ListGroup variant="transparent" className={cn('rounded-2xl bg-gray-1', className)} {...props}>
      {label != null && (
        <Text size="b2" weight="semibold" shade={9} className="px-4 pt-4 pb-1">
          {label}
        </Text>
      )}
      {children}
    </ListGroup>
  );
}

interface SettingsCardItemProps extends Omit<
  ComponentProps<typeof ListGroup.Item>,
  'children' | 'disabled'
> {
  label: string;
  description?: string;
  icon?: ReactNode;
  value?: ReactNode;
  right?: ReactNode;
  isSelected?: boolean;
  isDisabled?: boolean;
}

SettingsCard.Item = function Item({
  label,
  description,
  icon,
  value,
  right,
  isSelected = false,
  isDisabled = false,
  className,
  ...props
}: SettingsCardItemProps) {
  return (
    <ListGroup.Item
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      className={cn(
        'min-h-12 py-3 active:bg-gray-3 dark:active:bg-gray-2',
        isSelected && 'bg-gray-3 dark:bg-gray-2',
        isDisabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      {icon != null && <ListGroup.ItemPrefix>{icon}</ListGroup.ItemPrefix>}
      <ListGroup.ItemContent className="gap-0.5">
        <Text size="b2" shade={8} lineBreakStrategyIOS="hangul-word">
          {label}
        </Text>
        {description != null && (
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {description}
          </Text>
        )}
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        {right ?? (
          <HStack align="center" gap={4}>
            {value}
            <ArrowRightIcon colorClassName="text-gray-6" />
          </HStack>
        )}
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
};

interface SettingsCardItemSkeletonProps {
  descriptionLines?: number;
  hasValue?: boolean;
}

SettingsCard.ItemSkeleton = function ItemSkeleton({
  descriptionLines = 0,
  hasValue = false,
}: SettingsCardItemSkeletonProps) {
  return (
    <HStack align="center" gap={12} className="min-h-12 p-4 py-3">
      <VStack flex={1} gap={2}>
        <TextSkeleton size="b2" className="w-28" />
        {range(descriptionLines).map((line) => (
          <TextSkeleton key={line} size="b4" className="w-44" />
        ))}
      </VStack>
      <HStack align="center" gap={4}>
        {hasValue && <TextSkeleton size="b3" className="w-12" />}
        <ArrowRightIcon colorClassName="text-gray-3" />
      </HStack>
    </HStack>
  );
};

interface SettingsCardToggleProps extends Omit<ComponentProps<typeof ControlField>, 'children'> {
  label: string;
  description?: string;
}

SettingsCard.Toggle = function Toggle({
  label,
  description,
  className,
  ...props
}: SettingsCardToggleProps) {
  return (
    <ControlField className={cn('min-h-12 px-4 py-3', className)} {...props}>
      <Box className="flex-1 gap-0.5">
        <Text size="b2" shade={8} lineBreakStrategyIOS="hangul-word">
          {label}
        </Text>
        {description != null && (
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {description}
          </Text>
        )}
      </Box>
      <ControlField.Indicator />
    </ControlField>
  );
};

interface SettingsCardToggleSkeletonProps {
  hasDescription?: boolean;
}

SettingsCard.ToggleSkeleton = function ToggleSkeleton({
  hasDescription = false,
}: SettingsCardToggleSkeletonProps) {
  return (
    <HStack align="center" gap={12} className="min-h-12 px-4 py-3">
      <VStack flex={1} gap={2}>
        <TextSkeleton size="b2" className="w-24" />
        {hasDescription && <TextSkeleton size="b4" className="w-48" />}
      </VStack>
      <Skeleton className="h-6 w-12 rounded-full" />
    </HStack>
  );
};

SettingsCard.Content = function Content(props: ComponentProps<typeof VStack>) {
  return <VStack px={16} py={12} gap={12} {...props} />;
};

SettingsCard.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('common');

  return (
    <SettingsCard>
      <SettingsCard.Content>
        <Result
          className="py-4"
          title={t('errorBoundary.title')}
          description={t('errorBoundary.description')}
          button={<QueryErrorActions onRetry={reset} />}
        />
      </SettingsCard.Content>
    </SettingsCard>
  );
};

SettingsCard.Separator = function CardSeparator() {
  return <Separator className="mx-4 bg-gray-3 dark:bg-gray-2" />;
};

export interface SettingsScreenLayoutProps extends ComponentProps<typeof ScrollView> {
  gap?: ComponentProps<typeof ReadableContent>['gap'];
}

export function SettingsScreenLayout({ gap = 12, children, ...props }: SettingsScreenLayoutProps) {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic" {...props}>
        <StyledSafeAreaView edges={['left', 'right']}>
          <ReadableContent gap={gap} className="px-4 pb-4 pt-5">
            {children}
          </ReadableContent>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
