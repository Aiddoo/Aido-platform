import { range } from 'es-toolkit';
import { Children, isValidElement, type ReactNode } from 'react';
import type { WidgetInfo } from 'react-native-android-widget';

import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import { createInitialWidgetProps } from '../utils/widget-initial-props';
import { renderAndroidWidget } from './widgets.android';

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

type FunctionComponent = (props: NodeProps) => ReactNode;

// Widget 트리는 클래스 컴포넌트를 쓰지 않는다. prototype 표식으로 함수 컴포넌트만 직접 호출한다.
function isFunctionComponent(type: unknown): type is FunctionComponent {
  return typeof type === 'function' && !('isReactComponent' in type.prototype);
}

// The native tree collector invokes local components directly, without a React root.
function collect(node: ReactNode, result: WidgetNode[] = []): WidgetNode[] {
  Children.forEach(node, (child) => {
    if (!isValidElement<NodeProps>(child)) {
      return;
    }
    if (isFunctionComponent(child.type)) {
      collect(child.type(child.props), result);
      return;
    }
    result.push({ type: String(child.type), props: child.props });
    collect(child.props.children, result);
  });
  return result;
}

function createWidgetInfo(maxRows: number, overrides: Partial<WidgetInfo> = {}): WidgetInfo {
  return {
    widgetName:
      maxRows === 0 ? 'AidoTodaySummary' : maxRows > 3 ? 'AidoTodayLarge' : 'AidoTodayList',
    widgetId: 42,
    width: maxRows === 0 ? 178 : 374,
    height: maxRows > 3 ? 420 : 210,
    screenInfo: {
      screenWidthDp: 412,
      screenHeightDp: 915,
      density: 2.6,
      densityDpi: 420,
      fontScale: 1,
    },
    ...overrides,
  };
}

function createProps(maxRows: number, locale: 'ko' | 'en' = 'ko'): WidgetProps {
  return {
    ...createInitialWidgetProps(locale),
    state: 'data',
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
    weekTitle: locale === 'ko' ? '10월 1주차' : 'October · Week 1',
    weekRangeLabel: '9/27 – 10/3',
    openAppUrl: 'aido-dev://feed?date=today',
    addTodoUrl: 'aido-dev://feed?date=today&action=add-todo',
    topTodos: range(8).map((index) => ({
      id: index + 1,
      title: `Widget QA ${index + 1}`,
      completed: index < 3,
      color: '#4CBFA8',
      destination: `aido-dev://todo/${index + 1}`,
    })),
    weekDays: range(7).map((index) => ({
      date: `2026-10-0${index + 1}`,
      weekdayLabel:
        (locale === 'ko'
          ? ['일', '월', '화', '수', '목', '금', '토']
          : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        )[index] ?? '',
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
  info = createWidgetInfo(props.maxRows),
  userId: string | null = 'user-42',
) {
  const representation = renderAndroidWidget(props, info, userId);
  if (!('light' in representation)) {
    throw new Error('Theme variants missing');
  }
  return collect(representation[mode]);
}

function texts(nodes: WidgetNode[]) {
  return nodes.filter((node) => node.type === 'TextWidget').map((node) => node.props.text);
}

describe('Android 위젯 표시 계약', () => {
  it.each([0, 2, 4])('크기 %i의 모든 클릭을 하나의 collection 항목 안에 둔다', (maxRows) => {
    // Given
    const props = createProps(maxRows);

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
    [0, 0, ['🔥 12일'], ['＋ 할 일 만들기']],
    [2, 2, ['＋ 할 일 만들기'], []],
    [4, 4, ['＋ 할 일 만들기', '+4개 더'], []],
    [3, 2, ['＋ 할 일 만들기'], []],
    [8, 4, ['＋ 할 일 만들기', '+4개 더'], []],
  ])(
    '현재·이전 크기 %i에서 할 일을 %i행까지 표시한다',
    (maxRows, rows, shownTexts, hiddenTexts) => {
      // Given
      const props = createProps(maxRows);

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
      expect(texts(nodes)).toEqual(expect.arrayContaining(shownTexts));
      hiddenTexts.forEach((text) => {
        expect(texts(nodes)).not.toContain(text);
      });
    },
  );

  it.each(['ko', 'en'] as const)(
    '%s 대형 위젯의 할 일·7개 날짜·작성 클릭에 정확한 계정과 목적지를 붙인다',
    (locale) => {
      // Given
      const props = createProps(4, locale);

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
        ...createProps(maxRows),
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
        ...createProps(4, 'en'),
        state,
        stateTitle: state === 'stale' ? 'A fresh day is here' : 'Sign in to get started',
        stateCta: state === 'stale' ? 'Open Aido for today’s plans' : 'Tap to sign in',
      };

      // When
      const nodes = render(props, 'light', createWidgetInfo(4), null);

      // Then
      expect(texts(nodes)).toEqual([props.stateTitle, props.stateCta]);
      expect(
        nodes
          .filter((node) => node.props.clickActionData)
          .map((node) => node.props.clickActionData),
      ).toEqual([{ uri: props.openAppUrl, userId: null }]);
    },
  );
});
