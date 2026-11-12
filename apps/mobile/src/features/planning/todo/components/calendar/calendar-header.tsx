import { addMonthsToDateKey, getMonthStartDateKey } from '@src/shared/date/date-key';
import { formatDateKeyLabel } from '@src/shared/date/format/date-format';
import {
  formatWeekHeaderLabel,
  formatCalendarWeekLabel,
} from '@src/shared/date/format/date-labels';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { Box, Flex, HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Tabs } from 'heroui-native';
import {
  type ComponentProps,
  type ComponentRef,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { HostInstance, LayoutChangeEvent } from 'react-native';
import { match } from 'ts-pattern';

import { useFeedDateKey } from '../../hooks/use-feed-params';
import {
  type CalendarViewMode,
  calendarViewModeSchema,
  calendarViewModeStoredValue,
} from '../../schemas/calendar-view-mode-storage.schema';
import { shiftCalendarDateKey } from '../../utils/calendar-grid';
import {
  type CalendarHeaderLayout,
  getCalendarHeaderLayout,
} from '../../utils/calendar-header.geometry';
import { CalendarNavigation } from './calendar-navigation';

const HEADER_GAP = 8;
const MONTHS_PER_YEAR = 12;
// 29~31일에 시작하는 주가 5주차라 주 번호는 5를 넘지 않는다
const LAST_WEEK_OF_MONTH = 5;
// 견본과 보이는 제목이 같은 글자 모양이어야 잰 폭이 맞는다
const TITLE_TEXT_STYLE = { size: 'b1', weight: 'semibold' } as const;

export function CalendarHeader() {
  const { t } = useTranslation('common');
  const [selectedDateKey, setSelectedDateKey] = useFeedDateKey();
  const todayKey = useTodayKey();
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const {
    layout,
    rowRef,
    titleSamplesRef,
    todayRef,
    viewModeTabsRef,
    navigationRef,
    handleRowLayout,
  } = useCalendarHeaderLayout();
  const isInline = layout === 'inline';

  const handlePrevious = () =>
    setSelectedDateKey(shiftCalendarDateKey({ viewMode, dateKey: selectedDateKey, step: -1 }));
  const handleNext = () =>
    setSelectedDateKey(shiftCalendarDateKey({ viewMode, dateKey: selectedDateKey, step: 1 }));

  return (
    <Box className="px-4 py-2">
      {/* 두 배치가 같은 자식을 써서 배치가 바뀌어도 보기 전환 탭이 다시 마운트되지 않는다 */}
      <Flex
        ref={rowRef}
        onLayout={handleRowLayout}
        direction={isInline ? 'row' : 'column'}
        align={isInline ? 'center' : 'stretch'}
        justify="between"
        gap={HEADER_GAP}
      >
        <HStack gap={HEADER_GAP} align="center" className="min-w-0 shrink">
          <CalendarHeaderText />
          <PressableFeedback
            ref={todayRef}
            onPress={() => setSelectedDateKey(todayKey)}
            hitSlop={8}
            className="px-2 py-0.5 bg-gray-2 rounded-full"
          >
            <Text size="e1" weight="medium" shade={7}>
              {t('dateSections.today')}
            </Text>
          </PressableFeedback>
        </HStack>

        <HStack gap={HEADER_GAP} align="center" justify="between">
          <CalendarViewModeTabs ref={viewModeTabsRef} />
          <CalendarNavigation ref={navigationRef} onPrevious={handlePrevious} onNext={handleNext} />
        </HStack>
      </Flex>
      <CalendarTitleSamples ref={titleSamplesRef} />
    </Box>
  );
}

/**
 * 보이는 제목이 아니라 이 언어·보기에서 가장 긴 제목으로 정해, 주·달을 넘겨도 한 줄·두 줄이 바뀌지 않는다.
 * 재기 전에는 마지막으로 정한 배치를 그린다
 */
function useCalendarHeaderLayout() {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const { i18n } = useTranslation();
  const { fontScale } = useFontScale();
  const [layout, setLayout] = useState<CalendarHeaderLayout>('inline');
  const rowRef = useRef<ComponentRef<typeof Box>>(null);
  const titleSamplesRef = useRef<ComponentRef<typeof Box>>(null);
  const todayRef = useRef<ComponentRef<typeof PressableFeedback>>(null);
  const viewModeTabsRef = useRef<ComponentRef<typeof Tabs>>(null);
  const navigationRef = useRef<ComponentRef<typeof Box>>(null);
  const decidedWidthRef = useRef<number | null>(null);

  const decideLayout = () => {
    const availableWidth = measureWidth(rowRef.current);
    const widestTitleWidth = measureWidth(titleSamplesRef.current);
    const todayWidth = measureWidth(todayRef.current);
    const viewModeTabsWidth = measureWidth(viewModeTabsRef.current);
    const navigationWidth = measureWidth(navigationRef.current);
    if (
      availableWidth == null ||
      widestTitleWidth == null ||
      todayWidth == null ||
      viewModeTabsWidth == null ||
      navigationWidth == null
    ) {
      return;
    }
    decidedWidthRef.current = availableWidth;
    setLayout(
      getCalendarHeaderLayout({
        availableWidth,
        gap: HEADER_GAP,
        widestTitleWidth,
        todayWidth,
        viewModeTabsWidth,
        navigationWidth,
      }),
    );
  };
  const handleLayoutInputChange = useEffectEvent(decideLayout);

  // onLayout은 그린 뒤에 와 한 프레임 다른 배치가 보이므로 그리기 전에 동기로 잰다(New Architecture).
  // 언어는 탭·오늘 글자가 바뀐 뒤 값인 i18n 언어를 본다
  useLayoutEffect(() => {
    handleLayoutInputChange();
  }, [viewMode, i18n.language, fontScale]);

  // 배치가 바뀌면 높이만 달라지므로 폭이 바뀔 때만 다시 정한다
  const handleRowLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width !== decidedWidthRef.current) {
      decideLayout();
    }
  };

  return {
    layout,
    rowRef,
    titleSamplesRef,
    todayRef,
    viewModeTabsRef,
    navigationRef,
    handleRowLayout,
  };
}

/** New Architecture의 measure는 콜백을 바로 불러 그리기 전에 폭을 읽는다. 재지 못하면 null이다 */
function measureWidth(node: Pick<HostInstance, 'measure'> | null): number | null {
  let width: number | null = null;
  node?.measure((_x, _y, measuredWidth) => {
    width = measuredWidth;
  });
  return width;
}

/** 이 언어가 지금 보기에서 보일 수 있는 제목을 달마다 쌓아, 묶음 폭이 가장 긴 제목의 폭이다 */
function CalendarTitleSamples({ ref }: Pick<ComponentProps<typeof Box>, 'ref'>) {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();
  const monthStartDateKey = getMonthStartDateKey(todayDateKey);

  const titles = Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const monthDateKey = addMonthsToDateKey(monthStartDateKey, index);
    return match(viewMode)
      .with('week', () =>
        // 다른 해의 주에 붙는 연도는 뺀다. 넣으면 한국어 iPad 세로·Duo 칸(288pt)도 두 줄 배치가 된다.
        // 한 줄 배치에서 연도가 붙은 주가 넘치면 버튼 줄은 그대로 두고 제목만 감긴다
        formatWeekHeaderLabel(
          { monthDateKey, weekOfMonth: LAST_WEEK_OF_MONTH, hasYear: false },
          dateFormatContext,
        ),
      )
      .with('month', () => formatDateKeyLabel(monthDateKey, 'yearMonth', dateFormatContext))
      .exhaustive();
  });

  return (
    <Box
      ref={ref}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute left-0 top-0 opacity-0"
    >
      {titles.map((title) => (
        // 헤더보다 길면 줄바꿈 대신 헤더 폭으로 잘려 잰 폭이 짧아지지 않는다
        <Text key={title} {...TITLE_TEXT_STYLE} numberOfLines={1}>
          {title}
        </Text>
      ))}
    </Box>
  );
}

function CalendarHeaderText() {
  const [viewMode] = useStoredValue(calendarViewModeStoredValue);
  const [selectedDateKey] = useFeedDateKey();
  const todayDateKey = useTodayKey();
  const dateFormatContext = useDateFormatContext();

  const headerText = match(viewMode)
    .with('week', () => formatCalendarWeekLabel(selectedDateKey, todayDateKey, dateFormatContext))
    .with('month', () => formatDateKeyLabel(selectedDateKey, 'yearMonth', dateFormatContext))
    .exhaustive();

  return (
    <Text {...TITLE_TEXT_STYLE} className="shrink">
      {headerText}
    </Text>
  );
}

function CalendarViewModeTabs({ ref }: Pick<ComponentProps<typeof Tabs>, 'ref'>) {
  const { t } = useTranslation('todo');
  const [viewMode, setViewMode] = useStoredValue(calendarViewModeStoredValue);

  return (
    <Tabs
      ref={ref}
      value={viewMode}
      onValueChange={(next) => setViewMode(calendarViewModeSchema.parse(next))}
    >
      <Tabs.List className="gap-0 rounded-lg bg-gray-2">
        <Tabs.Indicator className="rounded-md bg-white shadow-none" />
        <CalendarViewModeTrigger value="week">{t('calendar.week')}</CalendarViewModeTrigger>
        <CalendarViewModeTrigger value="month">{t('calendar.month')}</CalendarViewModeTrigger>
      </Tabs.List>
    </Tabs>
  );
}

function CalendarViewModeTrigger({
  value,
  children,
}: {
  value: CalendarViewMode;
  children: string;
}) {
  return (
    <Tabs.Trigger value={value} hitSlop={4} className="p-0">
      {({ isSelected }) => (
        // 저장된 보기로 앱을 켜면 Tabs.Indicator가 그려지지 않을 때가 있어 선택 배경을 칸에도 둔다
        <Box className={cn('h-[22px] justify-center rounded-md px-2.5', isSelected && 'bg-white')}>
          <Text size="e1" weight="medium" shade={isSelected ? 9 : 5}>
            {children}
          </Text>
        </Box>
      )}
    </Tabs.Trigger>
  );
}
