import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { ControlField, ListGroup, RadioGroup, Separator, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import type { ScrollView } from 'react-native';

import { Box } from '../box';
import { ChoiceRadio } from '../choice-radio';
import { HStack } from '../h-stack';
import { ArrowRightIcon, type StyledIcon } from '../icon';
import { QueryErrorFallback, type QueryErrorFallbackProps } from '../query-error-boundary';
import { ReadableContent } from '../readable-content';
import { Result } from '../result';
import { SafeAreaScrollView } from '../safe-area-scroll-view';
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
  accessibilityState,
  className,
  ...props
}: SettingsListGroupItemProps) {
  return (
    <ListGroup.Item
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: isDisabled, ...accessibilityState }}
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
      {/* 좁아지면 값이 먼저 줄어 이름이 단어 중간에서 꺾이지 않는다. 값은 칸의 절반까지만 쓴다 */}
      <ListGroup.ItemSuffix className="max-w-1/2 shrink">
        {right ?? (
          <HStack align="center" gap={4} className="shrink">
            <Box className="shrink">{value}</Box>
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
  /** 글자, 또는 상태에 따라 글자를 고르는 컴포넌트(설명 글자 모양 안에 그려진다) */
  description?: ReactNode;
  icon?: ReactNode;
}

function SettingsListGroupToggle({
  label,
  description,
  icon,
  className,
  ...props
}: SettingsListGroupToggleProps) {
  return (
    <ControlField className={cn('min-h-12 px-4 py-3', className)} {...props}>
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

/** 메뉴 아이콘 칸. 옅은 브랜드 바탕 위에 듀오톤 아이콘을 브랜드 색으로 그려 목록마다 같은 크기·색으로 보인다 */
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
  /** 라디오 앞에 둘 짧은 표시(추천 칩 등). 글자와 같은 흐름에 놓여 큰 글꼴에서도 겹치지 않는다 */
  badge?: ReactNode;
}

/** `RadioGroup` 안에서 `.Item`과 같은 글자·여백으로 고르는 행. 오른쪽 화살표 자리에 라디오를 둔다 */
function SettingsListGroupRadio({
  label,
  description,
  icon,
  badge,
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
      {badge}
      <ChoiceRadio />
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

interface SettingsListGroupSegmentProps extends ComponentProps<typeof Box> {
  isFirst: boolean;
  isLast: boolean;
  /** 첫 조각에만 그리는 카드 제목 */
  label?: string;
}

/** 가상 목록의 행 하나를 카드 조각으로 그린다. 행마다 그려도 이어 붙이면 `SettingsListGroup` 한 장처럼 보인다 */
function SettingsListGroupSegment({
  isFirst,
  isLast,
  label,
  className,
  children,
  ...props
}: SettingsListGroupSegmentProps) {
  return (
    <Box
      className={cn('bg-gray-1', isFirst && 'rounded-t-2xl', isLast && 'rounded-b-2xl', className)}
      {...props}
    >
      {isFirst && label != null && <SettingsListGroupLabel label={label} />}
      {!isFirst && <SettingsListGroup.Separator />}
      {children}
    </Box>
  );
}

SettingsListGroup.Item = SettingsListGroupItem;
SettingsListGroup.Icon = SettingsListGroupIcon;
SettingsListGroup.Toggle = SettingsListGroupToggle;
SettingsListGroup.Radio = SettingsListGroupRadio;
SettingsListGroup.Segment = SettingsListGroupSegment;

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
    <SafeAreaScrollView className="flex-1 bg-white" {...props}>
      <ReadableContent gap={gap} className="px-4 pb-4 pt-5">
        {children}
      </ReadableContent>
    </SafeAreaScrollView>
  );
}
