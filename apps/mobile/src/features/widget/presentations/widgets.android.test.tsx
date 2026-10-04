import { runInNewContext } from 'node:vm';

import * as widgetComponents from '@expo/ui/jetpack-compose';
import * as widgetModifiers from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';
import { Children, createElement, isValidElement, type ReactNode } from 'react';

import type { WidgetProps } from '../models/widget-props.model';
import { createInitialWidgetProps } from './widget-initial-props';

jest.mock('@expo/ui/jetpack-compose', () => ({
  Box: 'Box',
  Button: 'Button',
  Column: 'Column',
  Image: 'Image',
  LinearProgressIndicator: 'LinearProgressIndicator',
  Row: 'Row',
  Spacer: 'Spacer',
  Text: 'Text',
}));

jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  background: jest.fn(),
  cornerRadius: jest.fn(),
  fillMaxSize: jest.fn(),
  fillMaxHeight: jest.fn(),
  fillMaxWidth: jest.fn(),
  height: jest.fn(),
  paddingAll: jest.fn(),
  padding: jest.fn(),
  size: jest.fn(),
  width: jest.fn(),
}));

jest.mock('expo-widgets', () => ({ createWidget: jest.fn(() => ({})) }));

require('./widgets.android');
const widgetRegistrations = [...jest.mocked(createWidget).mock.calls];

function inspectLayout(node: ReactNode, titles: string[], columnChildCounts: number[]) {
  Children.forEach(node, (child) => {
    if (typeof child === 'string') {
      titles.push(child);
      return;
    }
    if (!isValidElement<{ children?: ReactNode }>(child)) return;

    if (String(child.type) === 'Column') {
      columnChildCounts.push(Children.toArray(child.props.children).length);
    }
    inspectLayout(child.props.children, titles, columnChildCounts);
  });
}

describe('Android 위젯 격리 렌더링', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-02T12:00:00'));
  });

  afterAll(() => jest.useRealTimers());

  it.each([
    [0, 0],
    [2, 2],
    [4, 4],
    [3, 2],
    [8, 4],
  ])('새 크기와 이전 크기 %i는 %i행을 Glance 제한 안에서 표시한다', (maxRows, visibleRows) => {
    // Given
    const registration = widgetRegistrations.find(
      ([name]) =>
        name ===
        (maxRows === 0 ? 'AidoTodaySummary' : maxRows <= 3 ? 'AidoTodayList' : 'AidoTodayLarge'),
    );
    if (!registration) throw new Error('Widget registration missing');

    const props: WidgetProps = {
      ...createInitialWidgetProps(),
      state: 'data',
      date: '2026-10-02',
      maxRows,
      totalTodos: 8,
      completedTodos: 0,
      topTodos: Array.from({ length: 8 }, (_, index) => ({
        id: index + 1,
        destination: `aido://todo/${index + 1}`,
        title: `Widget QA ${index + 1}`,
        completed: false,
        color: '#FF6B43',
      })),
    };
    const titles: string[] = [];
    const columnChildCounts: number[] = [];

    const jsx = (type: string, elementProps: object) => createElement(type, elementProps);
    const render: unknown = runInNewContext(`(${String(registration[1])})`, {
      ...widgetComponents,
      ...widgetModifiers,
      Date,
      _jsx: jsx,
      _jsxs: jsx,
    });
    if (typeof render !== 'function') throw new Error('Widget layout is not callable');
    // When
    const layout: unknown = render(props, { colorScheme: 'light' });
    if (!isValidElement(layout)) throw new Error('Widget layout is not an element');

    inspectLayout(layout, titles, columnChildCounts);

    // Then
    expect(titles.filter((title) => title.startsWith('Widget QA '))).toHaveLength(visibleRows);
    expect(columnChildCounts.every((count) => count <= 10)).toBe(true);
  });
});
