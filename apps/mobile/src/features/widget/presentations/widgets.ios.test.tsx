import { runInNewContext } from 'node:vm';

import * as widgetComponents from '@expo/ui/swift-ui';
import * as widgetModifiers from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import { Children, createElement, isValidElement, type ReactNode } from 'react';

import {
  buildWidgetSnapshotContext,
  buildWidgetSummary,
} from '../__tests__/widget-snapshot.factory';
import { toWidgetProps } from '../services/widget-props.mapper';
import { toWidgetSnapshot } from '../services/widget-snapshot.mapper';

jest.mock('@expo/ui/swift-ui', () => ({
  Gauge: 'Gauge',
  Divider: 'Divider',
  Link: 'Link',
  HStack: 'HStack',
  Image: 'Image',
  RoundedRectangle: 'RoundedRectangle',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
  ZStack: 'ZStack',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  containerBackground: jest.fn(),
  background: jest.fn(),
  cornerRadius: jest.fn(),
  font: jest.fn(),
  foregroundColor: jest.fn(),
  frame: jest.fn(),
  gaugeStyle: jest.fn(),
  lineLimit: jest.fn(),
  monospacedDigit: jest.fn(),
  minimumScaleFactor: jest.fn(),
  strikethrough: jest.fn(),
  opacity: jest.fn(),
  padding: jest.fn(),
  tint: jest.fn(),
  widgetURL: (url: string) => ({ $type: 'widgetURL', url }),
}));
jest.mock('expo-widgets', () => ({ createWidget: jest.fn(() => ({})) }));

require('./widgets.ios');
const registration = jest.mocked(createWidget).mock.calls[0];

function inspectLayout(
  node: ReactNode,
  titles: string[],
  destinations: string[],
  widgetUrls: string[],
  pawColors: string[],
) {
  Children.forEach(node, (child) => {
    if (typeof child === 'string') {
      titles.push(child);
      return;
    }
    if (
      !isValidElement<{
        children?: ReactNode;
        destination?: string;
        modifiers?: { $type?: string; url?: string }[];
        color?: string;
        systemName?: string;
      }>(child)
    )
      return;
    if (String(child.type) === 'Link' && child.props.destination)
      destinations.push(child.props.destination);
    if (
      String(child.type) === 'Image' &&
      child.props.systemName === 'pawprint.fill' &&
      child.props.color
    )
      pawColors.push(child.props.color);
    for (const modifier of child.props.modifiers ?? []) {
      if (modifier?.$type === 'widgetURL' && modifier.url) widgetUrls.push(modifier.url);
    }
    inspectLayout(child.props.children, titles, destinations, widgetUrls, pawColors);
  });
}

describe('iOS 위젯 격리 렌더링과 앱 이동', () => {
  it.each([
    ['systemSmall', 0],
    ['systemMedium', 2],
    ['systemLarge', 4],
  ] as const)(
    '%s는 %i개 할 일을 표시하고 루트 이동 URL을 한 번만 지정한다',
    (widgetFamily, visibleRows) => {
      // Given
      if (!registration) throw new Error('위젯 등록을 찾지 못했습니다');
      const snapshot = toWidgetSnapshot(
        buildWidgetSummary({
          topTodos: Array.from({ length: 8 }, (_, index) => ({
            id: index + 1,
            title: `QA 할 일 ${index + 1}`,
            completed: false,
            categoryColor: '#FF6B43',
          })),
        }),
        buildWidgetSnapshotContext(),
      );
      const props = toWidgetProps(snapshot, 'data', 'aido-dev');
      const jsx = (type: string, elementProps: object) => createElement(type, elementProps);
      const render: unknown = runInNewContext(`(${String(registration[1])})`, {
        ...widgetComponents,
        ...widgetModifiers,
        _jsx: jsx,
        _jsxs: jsx,
      });
      if (typeof render !== 'function') throw new Error('위젯을 실행할 수 없습니다');
      const titles: string[] = [],
        destinations: string[] = [],
        widgetUrls: string[] = [],
        pawColors: string[] = [];
      // When
      inspectLayout(
        render(props, { colorScheme: 'dark', widgetFamily }),
        titles,
        destinations,
        widgetUrls,
        pawColors,
      );
      // Then
      expect(titles.filter((title) => title.startsWith('QA 할 일 '))).toHaveLength(visibleRows);
      expect(widgetUrls).toEqual(['aido-dev://feed?date=today']);
      expect(pawColors.filter((color) => color === '#FF6B43').length).toBeGreaterThanOrEqual(2);
      if (visibleRows > 0) {
        expect(destinations).toContain('aido-dev://feed?date=today&action=add-todo');
        expect(destinations).toContain('aido-dev://todo/1');
      }
      if (widgetFamily === 'systemLarge')
        expect(
          destinations.filter((url) => url.includes('/feed?date=') && !url.includes('&action=')),
        ).toHaveLength(7);
    },
  );
});
