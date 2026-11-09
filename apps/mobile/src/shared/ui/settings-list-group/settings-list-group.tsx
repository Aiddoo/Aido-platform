import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { ControlField, ListGroup, Radio, RadioGroup, Separator, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { Box } from '../box';
import { HStack } from '../h-stack';
import { ArrowRightIcon, type StyledIcon } from '../icon';
import { QueryErrorFallback, type QueryErrorFallbackProps } from '../query-error-boundary';
import { ReadableContent } from '../readable-content';
import { Result } from '../result';
import { StyledSafeAreaView } from '../styled-safe-area-view';
import { Text, TextSkeleton } from '../text';
import { VStack } from '../v-stack';

export interface SettingsListGroupProps extends ComponentProps<typeof ListGroup> {
  label?: string;
}

export function SettingsListGroup({
  label,
  className,
  children,
  ...props
}: SettingsListGroupProps) {
  return (
    <ListGroup variant="transparent" className={cn('rounded-2xl bg-gray-1', className)} {...props}>
      {label != null && <SettingsListGroupLabel label={label} />}
      {children}
    </ListGroup>
  );
}

function SettingsListGroupLabel({ label }: { label: string }) {
  return (
    <Text size="b2" weight="semibold" shade={9} className="px-4 pt-4 pb-1">
      {label}
    </Text>
  );
}

interface SettingsListGroupItemProps extends Omit<
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

function SettingsListGroupItem({
  label,
  description,
  icon,
  value,
  right,
  isSelected = false,
  isDisabled = false,
  className,
  ...props
}: SettingsListGroupItemProps) {
  return (
    <ListGroup.Item
      accessibilityRole="button"
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
}

interface SettingsListGroupItemLoadingProps {
  descriptionLines?: number;
  hasValue?: boolean;
}

SettingsListGroupItem.Loading = function Loading({
  descriptionLines = 0,
  hasValue = false,
}: SettingsListGroupItemLoadingProps) {
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

interface SettingsListGroupToggleProps extends Omit<
  ComponentProps<typeof ControlField>,
  'children'
> {
  label: string;
  description?: string;
}

function SettingsListGroupToggle({
  label,
  description,
  className,
  ...props
}: SettingsListGroupToggleProps) {
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
}

interface SettingsListGroupToggleLoadingProps {
  hasDescription?: boolean;
}

SettingsListGroupToggle.Loading = function Loading({
  hasDescription = false,
}: SettingsListGroupToggleLoadingProps) {
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

/** 메뉴 아이콘 칸. 옅은 브랜드 바탕 위에 브랜드 색 선 아이콘을 그려 목록마다 같은 크기·색으로 보인다 */
const ITEM_ICON_TILE_SIZE = 30;
const ITEM_ICON_SIZE = 18;

function SettingsListGroupIcon({ Icon }: { Icon: StyledIcon }) {
  const fontScaledSize = useFontScaledSize();
  const tileSize = fontScaledSize(ITEM_ICON_TILE_SIZE);
  const iconSize = fontScaledSize(ITEM_ICON_SIZE);

  return (
    <Box
      accessible={false}
      importantForAccessibility="no"
      className="items-center justify-center rounded-[9px] bg-main/10"
      style={{ width: tileSize, height: tileSize }}
    >
      <Icon width={iconSize} height={iconSize} colorClassName="text-main" />
    </Box>
  );
}

interface SettingsListGroupRadioProps extends Omit<
  ComponentProps<typeof RadioGroup.Item>,
  'children'
> {
  label: string;
  description?: string;
  icon?: ReactNode;
}

/** `RadioGroup` 안에서 `.Item`과 같은 글자·여백으로 고르는 행. 오른쪽 화살표 자리에 라디오를 둔다 */
function SettingsListGroupRadio({
  label,
  description,
  icon,
  className,
  ...props
}: SettingsListGroupRadioProps) {
  return (
    <RadioGroup.Item
      className={cn(
        'min-h-12 px-4 py-3 active:bg-gray-3 disabled:opacity-40 dark:active:bg-gray-2',
        className,
      )}
      {...props}
    >
      {icon}
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
      <Radio />
    </RadioGroup.Item>
  );
}

SettingsListGroupRadio.Loading = function Loading({ icon }: { icon?: ReactNode }) {
  return (
    <HStack align="center" gap={12} className="min-h-12 px-4 py-3">
      {icon}
      <VStack flex={1}>
        <TextSkeleton size="b2" className="w-24" />
      </VStack>
      <Skeleton className="size-6 rounded-full" />
    </HStack>
  );
};

SettingsListGroup.Item = SettingsListGroupItem;
SettingsListGroup.Icon = SettingsListGroupIcon;
SettingsListGroup.Toggle = SettingsListGroupToggle;
SettingsListGroup.Radio = SettingsListGroupRadio;

SettingsListGroup.Content = function Content(props: ComponentProps<typeof VStack>) {
  return <VStack px={16} py={12} gap={12} {...props} />;
};

SettingsListGroup.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return (
    <SettingsListGroup>
      <SettingsListGroup.Content>
        <QueryErrorFallback className="py-4" illustrationSize="block" reset={reset} />
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
};

SettingsListGroup.Empty = function Empty(props: ComponentProps<typeof Result>) {
  return (
    <Box className="rounded-[20px] border border-dashed border-gray-3 bg-gray-1 px-5 py-7">
      <Result {...props} />
    </Box>
  );
};

SettingsListGroup.Separator = function CardSeparator() {
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
