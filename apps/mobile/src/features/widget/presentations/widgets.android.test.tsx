import { Children, isValidElement, type ReactNode } from 'react';
import type { WidgetInfo } from 'react-native-android-widget';

import type { WidgetProps } from '../models/widget-props.model';
import { createInitialWidgetProps } from './widget-initial-props';
import { renderAndroidWidget } from './widgets.android';

jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  ListWidget: 'ListWidget',
  TextWidget: 'TextWidget',
  SvgWidget: 'SvgWidget',
}));

type NodeProps = {
  children?: ReactNode;
  text?: string;
  svg?: string;
  style?: Record<string, unknown>;
  maxLines?: number;
  truncate?: string;
  allowFontScaling?: boolean;
  clickAction?: string;
  clickActionData?: Record<string, unknown>;
};

type WidgetNode = { type: string; props: NodeProps };

// The native tree collector invokes local components directly, without a React root.
function collect(node: ReactNode, result: WidgetNode[] = []): WidgetNode[] {
  Children.forEach(node, (child) => {
    if (!isValidElement<NodeProps>(child)) return;
    if (typeof child.type === 'function') {
      const component = child.type as (props: NodeProps) => ReactNode;
      collect(component(child.props), result);
      return;
    }
    result.push({ type: String(child.type), props: child.props });
    collect(child.props.children, result);
  });
  return result;
}

function buildWidgetInfo(maxRows: number, overrides: Partial<WidgetInfo> = {}): WidgetInfo {
  return {
    widgetName:
      maxRows === 0 ? 'AidoTodaySummary' : maxRows > 3 ? 'AidoTodayLarge' : 'AidoTodayList',
    widgetId: 42,
    width: maxRows === 0 ? 178 : 374,
    height: maxRows > 3 ? 420 : 210,
    screenInfo: { screenWidthDp: 412, screenHeightDp: 915, density: 2.6, densityDpi: 420 },
    ...overrides,
  };
}

function buildProps(maxRows: number, locale: 'ko' | 'en' = 'ko'): WidgetProps {
  return {
    ...createInitialWidgetProps(locale),
    state: 'data',
    date: '2026-10-02',
    maxRows,
    totalTodos: 8,
    completedTodos: 3,
    completionRate: 37.5,
    currentStreak: 12,
    progressTitle: locale === 'ko' ? '오늘의 할 일' : "Today's to-dos",
    percentLabel: '37.5%',
    compactStreakLabel: locale === 'ko' ? '12일' : '12d',
    allDoneLabel: locale === 'ko' ? '모두 완료!' : 'All done!',
    moreLabelTemplate: locale === 'ko' ? '+{count}개 더' : '+{count} more',
    weekTitle: locale === 'ko' ? '10월, 1주차 발자국' : 'October · Week 1',
    weekRangeLabel: '9/27 – 10/3',
    openAppUrl: 'aido-dev://feed?date=today',
    addTodoUrl: 'aido-dev://feed?date=today&action=add-todo',
    topTodos: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      title: `Widget QA ${index + 1}`,
      completed: index < 3,
      color: '#4CBFA8',
      destination: `aido-dev://todo/${index + 1}`,
    })),
    weekDays: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-0${index + 1}`,
      weekdayLabel:
        (locale === 'ko'
          ? ['일', '월', '화', '수', '목', '금', '토']
          : ['S', 'M', 'T', 'W', 'T', 'F', 'S'])[index] ?? '',
      dayLabel: String(index + 1),
      isComplete: index === 1,
      hasTodos: index < 4,
      isToday: index === 2,
      destination: `aido-dev://feed?date=2026-10-0${index + 1}`,
    })),
  };
}

function render(
  props: WidgetProps,
  mode: 'light' | 'dark' = 'light',
  info = buildWidgetInfo(props.maxRows),
  userId: string | null = 'user-42',
) {
  const representation = renderAndroidWidget(props, info, userId);
  if (!('light' in representation)) throw new Error('Theme variants missing');
  return collect(representation[mode]);
}

function texts(nodes: WidgetNode[]) {
  return nodes.filter((node) => node.type === 'TextWidget').map((node) => node.props.text);
}

describe('Android 위젯 표시 계약', () => {
  it.each([0, 2, 4])('크기 %i의 모든 클릭을 하나의 collection 항목 안에 둔다', (maxRows) => {
    // Given
    const props = buildProps(maxRows);

    // When
    const nodes = render(props);
    const collections = nodes.filter((node) => node.type === 'ListWidget');
    const collection = collections[0];
    const itemNodes = collect(collection?.props.children);

    // Then
    expect(collections).toHaveLength(1);
    expect(Children.count(collection?.props.children)).toBe(1);
    expect(itemNodes.filter((node) => node.props.clickActionData)).toEqual(
      nodes.filter((node) => node.props.clickActionData),
    );
  });

  it.each([
    [0, 0],
    [2, 2],
    [4, 4],
    [3, 2],
    [8, 4],
  ])('현재·이전 크기 %i에서 할 일을 %i행까지 표시한다', (maxRows, rows) => {
    // Given
    const props = buildProps(maxRows);
    // When
    const nodes = render(props);
    // Then
    expect(texts(nodes).filter((text) => text?.startsWith('Widget QA '))).toEqual(
      props.topTodos.slice(0, rows).map((todo) => todo.title),
    );
    expect(texts(nodes)).toContain('3');
    expect(texts(nodes)).toContain('/8');
    expect(
      nodes
        .filter((node) => node.props.svg)
        .every((node) => (node.props.svg?.match(/<path /g) ?? []).length === 2),
    ).toBe(true);
    if (rows === 0) {
      expect(texts(nodes)).toContain('🔥 12일');
      expect(texts(nodes)).not.toContain('＋ 할 일 만들기');
    } else {
      expect(texts(nodes)).toContain('＋ 할 일 만들기');
    }
    if (rows === 4) expect(texts(nodes)).toContain('+4개 더');
  });

  it.each(['ko', 'en'] as const)(
    '%s 대형 위젯의 할 일·7개 날짜·작성 클릭에 정확한 계정과 목적지를 붙인다',
    (locale) => {
      // Given
      const props = buildProps(4, locale);
      // When
      const nodes = render(props);
      const clicks = nodes.filter((node) => node.props.clickAction);
      // Then
      expect(clicks).toHaveLength(13);
      expect(clicks.every((node) => node.props.clickAction === 'AIDO_WIDGET_NAVIGATE')).toBe(true);
      expect(clicks.map((node) => node.props.clickActionData)).toEqual([
        { uri: props.openAppUrl, userId: 'user-42' },
        ...(props.weekDays ?? []).map((day) => ({ uri: day.destination, userId: 'user-42' })),
        ...props.topTodos.slice(0, 4).map((todo) => ({ uri: todo.destination, userId: 'user-42' })),
        { uri: props.addTodoUrl, userId: 'user-42' },
      ]);
      expect(texts(nodes)).toContain(locale === 'ko' ? '+4개 더' : '+4 more');
    },
  );

  it.each([0, 2, 4])(
    '크기 %i의 빈 상태는 오래된 행을 숨기고 지원되는 작성 동작을 남긴다',
    (maxRows) => {
      // Given
      const props = {
        ...buildProps(maxRows),
        state: 'empty' as const,
        totalTodos: 0,
        stateTitle: 'No to-dos for today yet',
        stateCta: 'Add your first to-do',
      };
      // When
      const nodes = render(props);
      // Then
      expect(texts(nodes)).toContain(props.stateTitle);
      expect(texts(nodes).some((text) => text?.startsWith('Widget QA '))).toBe(false);
      expect(nodes.some((node) => node.props.clickActionData?.uri === props.addTodoUrl)).toBe(
        maxRows !== 0,
      );
    },
  );

  it.each(['loggedOut', 'stale'] as const)(
    '%s 상태에서는 개인정보 대신 안내문과 앱 열기를 표시한다',
    (state) => {
      // Given
      const props = {
        ...buildProps(4, 'en'),
        state,
        stateTitle: state === 'stale' ? 'A fresh day is here' : 'Sign in to get started',
        stateCta: state === 'stale' ? 'Open Aido for today’s plans' : 'Tap to sign in',
      };
      // When
      const nodes = render(props, 'light', buildWidgetInfo(4), null);
      // Then
      expect(texts(nodes)).toEqual([props.stateTitle, props.stateCta]);
      expect(
        nodes
          .filter((node) => node.props.clickActionData)
          .map((node) => node.props.clickActionData),
      ).toEqual([{ uri: props.openAppUrl, userId: null }]);
    },
  );

  it('밝고 어두운 테마가 같은 데이터와 이동 목적지를 유지한다', () => {
    // Given
    const props = buildProps(4);
    // When
    const light = render(props, 'light');
    const dark = render(props, 'dark');
    // Then
    expect(texts(light)).toEqual(texts(dark));
    expect(
      light.filter((node) => node.props.clickActionData).map((node) => node.props.clickActionData),
    ).toEqual(
      dark.filter((node) => node.props.clickActionData).map((node) => node.props.clickActionData),
    );
    expect(
      light.find((node) => node.props.style?.backgroundColor)?.props.style?.backgroundColor,
    ).toBe('#FFFFFF');
    expect(
      dark.find((node) => node.props.style?.backgroundColor)?.props.style?.backgroundColor,
    ).toBe('#171310');
    expect(light.find((node) => node.props.text === 'Widget QA 1')?.props.style?.color).toBe(
      '#8F8F8F',
    );
    expect(dark.find((node) => node.props.text === 'Widget QA 1')?.props.style?.color).toBe(
      '#B7B7B7',
    );
  });

  it('긴 제목에는 한 줄 말줄임을 적용하고 큰 카운트는 축소한다', () => {
    // Given
    const props = { ...buildProps(2), completedTodos: 12345, totalTodos: 999999 };
    props.topTodos[0] = { ...props.topTodos[0]!, title: '아주 긴 제목 '.repeat(30) };
    // When
    const nodes = render(props);
    const title = nodes.find((node) => node.props.text === props.topTodos[0]?.title);
    const count = nodes.find((node) => node.props.text === '12345');
    // Then
    expect(title?.props).toMatchObject({ maxLines: 1, truncate: 'END', allowFontScaling: false });
    expect(count?.props.style?.fontSize).toBeLessThan(32);
    expect(texts(nodes)).toContain('/999999');
    expect(
      nodes
        .filter((node) => node.type === 'TextWidget')
        .every((node) => node.props.allowFontScaling === false),
    ).toBe(true);
  });

  it.each([
    [0, 1],
    [2, 2.05],
    [4, 0.97],
  ])('크기 %i의 슬롯이 커져도 카드 비율 %s를 유지한다', (maxRows, aspect) => {
    // Given
    const props = buildProps(maxRows);
    // When
    const nodes = render(props, 'light', buildWidgetInfo(maxRows, { width: 320, height: 600 }));
    const card = nodes.find((node) => node.props.style?.backgroundColor);
    const slot = nodes.find((node) => node.props.style?.justifyContent === 'center');
    // Then
    expect(card?.props.style?.width).toBe(320);
    expect(card?.props.style?.height).toBeCloseTo(320 / aspect);
    expect(slot?.props.style).toMatchObject({
      width: 320,
      height: 600,
      justifyContent: 'center',
    });
  });

  it('유효하지 않은 슬롯 치수는 기본 카드로 복구한다', () => {
    // Given
    const props = buildProps(0);
    // When
    const nodes = render(props, 'light', buildWidgetInfo(0, { width: NaN, height: 0 }));
    const card = nodes.find((node) => node.props.style?.backgroundColor);
    const slot = nodes.find((node) => node.props.style?.justifyContent === 'center');
    // Then
    expect(slot?.props.style).toMatchObject({ width: 160, height: 160 });
    expect(card?.props.style).toMatchObject({ width: 160, height: 160 });
  });
});
