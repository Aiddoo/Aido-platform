import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BellOffIcon,
  Box,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  LockIcon,
  Meter,
  RepeatIcon,
  Text,
  TextSkeleton,
  VStack,
  Checkbox,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { isNotNil } from 'es-toolkit';
import { PressableFeedback, Skeleton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

import { isRecurring } from '../domains/todo.model';
import { type Todo } from '../domains/todo.model';
import {
  formatRepeatCadence,
  formatRepeatRuleLabel,
} from '../utils/todo-repeat-summary.view-model';

/** `TodoRow.Label`의 b3 한 줄 높이. 잠금 아이콘을 첫 줄 가운데에 맞춘다 */
const TITLE_LINE_HEIGHT = 20;
const REPEAT_ICON_SIZE = 13;
const SPOKEN_WEEKDAY_SEPARATOR = ', ';

export const TODO_ROW_ACCESSIBILITY_ACTION = {
  toggleCompleted: 'toggleCompleted',
  comments: 'comments',
  more: 'more',
} as const;

interface TodoRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  left?: ReactNode;
  top: ReactNode;
  middle?: ReactNode;
  bottom?: ReactNode;
  right?: ReactNode;
  isActive?: boolean;
  children?: ReactNode;
}

interface TodoLabelProps extends Omit<
  ComponentProps<typeof Text>,
  'size' | 'weight' | 'strikethrough' | 'shade' | 'children'
> {
  isCompleted: boolean;
  children: string;
}

interface TodoTitleLineProps {
  label: ReactNode;
  isPrivate: boolean;
}

interface TodoScheduleLineProps {
  todo: Pick<Todo, 'repeat' | 'recurrenceGroupId'>;
  /** 표시할 시간. 종일이면 null */
  timeLabel: string | null;
  /** 알림이 닿지 않아 시간 옆에 종 꺼짐을 그린다 */
  isReminderOff?: boolean;
}

type TodoProgressTone = 'surface' | 'onSky';

interface TodoProgressProps {
  value: number;
  total: number;
  /** 날씨 하늘처럼 늘 어두운 면 위에서는 onSky로 흰 막대·글자를 쓴다. */
  tone?: TodoProgressTone;
}

export function TodoRow({
  left,
  top,
  middle,
  bottom,
  right,
  onPress,
  onLongPress,
  isActive,
  isDisabled,
  children,
  className,
  ...pressableProps
}: TodoRowProps) {
  return (
    <>
      <PressableFeedback
        {...pressableProps}
        onPress={onPress}
        onLongPress={onLongPress}
        isDisabled={isActive || isDisabled || (!onPress && !onLongPress)}
        className={cn(
          'rounded-xl py-2',
          isActive && 'bg-gray-1',
          isDisabled && 'opacity-50',
          className,
        )}
      >
        <HStack gap={12} align="center">
          {left}
          <VStack flex={1} gap={2}>
            {top}
            {middle}
            {bottom}
          </VStack>
          {right}
        </HStack>
      </PressableFeedback>
      {children}
    </>
  );
}

TodoRow.Checkbox = function RowCheckbox({
  isSelected,
  onSelectedChange,
  isDisabled,
  className,
  ...props
}: ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox
      {...props}
      className={className}
      isSelected={isSelected}
      onSelectedChange={onSelectedChange}
      isDisabled={isDisabled || onSelectedChange == null}
    />
  );
};

TodoRow.Label = function Label({ isCompleted, children, ...props }: TodoLabelProps) {
  return (
    <Text
      size="b3"
      weight="medium"
      strikethrough={isCompleted}
      shade={isCompleted ? 5 : undefined}
      lineBreakStrategyIOS="hangul-word"
      {...props}
    >
      {children}
    </Text>
  );
};

TodoRow.TitleLine = function TitleLine({ label, isPrivate }: TodoTitleLineProps) {
  const fontScaledSize = useFontScaledSize();

  return (
    <HStack gap={4} align="start">
      {label}
      {isPrivate && (
        <Box className="justify-center" style={{ height: fontScaledSize(TITLE_LINE_HEIGHT) }}>
          <LockIcon
            width={fontScaledSize(14)}
            height={fontScaledSize(14)}
            colorClassName="text-gray-5"
          />
        </Box>
      )}
    </HStack>
  );
};

TodoRow.ScheduleLine = function ScheduleLine({
  todo,
  timeLabel,
  isReminderOff = false,
}: TodoScheduleLineProps) {
  const { t, i18n } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const repeatIconSize = fontScaledSize(REPEAT_ICON_SIZE);
  const { repeat } = todo;
  const isRepeating = isRecurring(todo.recurrenceGroupId);
  const ruleLabel = formatRepeatRuleLabel(repeat, i18n.language);
  const spokenRule =
    repeat == null
      ? t('chip.repeat')
      : t('repeat.spokenRule', {
          rule: formatRepeatCadence(repeat, i18n.language, {
            weekdaySeparator: SPOKEN_WEEKDAY_SEPARATOR,
          }),
        });
  const hasReminderOffMark = isReminderOff && timeLabel != null;
  const spokenLabel = [
    timeLabel,
    hasReminderOffMark ? t('list.reminderOff') : null,
    isRepeating ? spokenRule : null,
  ]
    .filter(isNotNil)
    .join(', ');

  return (
    <HStack gap={4} align="center" className="flex-wrap" accessibilityLabel={spokenLabel}>
      {timeLabel != null && (
        <Text size="e1" shade={6} className="tabular-nums">
          {timeLabel}
        </Text>
      )}
      {hasReminderOffMark && (
        <BellOffIcon width={repeatIconSize} height={repeatIconSize} colorClassName="text-gray-5" />
      )}
      {timeLabel != null && isRepeating && (
        <Text size="e1" shade={6}>
          ·
        </Text>
      )}
      {isRepeating && (
        <HStack gap={2} align="center" className="shrink">
          <RepeatIcon width={repeatIconSize} height={repeatIconSize} colorClassName="text-gray-6" />
          <Text size="e1" shade={6} className="shrink">
            {ruleLabel}
          </Text>
        </HStack>
      )}
    </HStack>
  );
};

TodoRow.Progress = function Progress({ value, total, tone = 'surface' }: TodoProgressProps) {
  return (
    <HStack gap={6} align="center">
      <Meter
        value={value}
        max={total}
        tone={tone}
        className="w-10"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text
        size="e1"
        tone={tone === 'onSky' ? 'onSky' : undefined}
        shade={tone === 'onSky' ? undefined : 6}
        className={cn(tone === 'onSky' && 'text-on-sky/60 tabular-nums')}
      >
        {value}/{total}
      </Text>
    </HStack>
  );
};

TodoRow.Loading = function Loading() {
  return (
    <TodoRow
      left={<Skeleton className="size-5 rounded-md" />}
      top={<TextSkeleton size="b3" className="w-3/4" />}
      right={
        <Box className="px-2 py-1.5">
          <Skeleton
            className="rounded-full"
            style={{ width: ICON_COUNT_BUTTON_ICON_SIZE, height: ICON_COUNT_BUTTON_ICON_SIZE }}
          />
        </Box>
      }
    />
  );
};
