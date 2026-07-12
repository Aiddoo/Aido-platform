import { Gauge, HStack, RoundedRectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundColor,
  frame,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  opacity,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { IosWidgetProps } from './ios-widget-props';

/**
 * 오늘 할 일 위젯 — 단일 레이아웃이 3개 패밀리를 담당한다.
 *
 * - systemSmall: 컴팩트 진행 요약 (분수 히어로 + 선형 바 + 스트릭)
 * - systemMedium: 헤더 + 상위 3개 할 일 (카테고리 컬러 체크박스)
 * - systemLarge: 헤더 + 상위 8개 할 일
 *
 * 디자인: Linear 스타일 절제 + 포인트 — 웜 다크 배경(#171310), rounded/모노 숫자
 * 타이포(완료 수만 브랜드 컬러), 발자국 액센트, 완료 시 🎉 축하.
 *
 * 'widget' 디렉티브 함수는 빌드 타임에 소스 문자열로 추출되어 위젯 확장의
 * 격리된 런타임에서 실행된다 — 모듈 스코프(임포트 값·상수·헬퍼) 참조 금지,
 * 팔레트는 widget-colors.constant.ts와 동일 값의 인라인 복사본이다.
 *
 * ⚠️ 네이티브 렌더러(DynamicView.swift)는 children 배열에서 dict가 아닌 항목을
 * 버리므로 `{array.map(...)}`(중첩 배열 자식)은 조용히 사라진다. 리스트 행은
 * 반드시 고정 슬롯(`{renderRow(todos[i])}`)으로 펼쳐 단일 노드/null만 자식이 되게 한다.
 * 같은 이유로 JSX를 props로 받는 API(Gauge currentValueLabel 등)도 렌더되지 않는다.
 */
function AidoTodayListLayout(props: IosWidgetProps, environment: WidgetEnvironment) {
  'widget';

  const isDark = environment.colorScheme === 'dark';
  const palette = {
    background: isDark ? '#171310' : '#FFFFFF',
    foreground: isDark ? '#F5F5F5' : '#333333',
    muted: isDark ? '#B7B7B7' : '#8F8F8F',
    brand: '#FF6B43',
  };

  if (props.state !== 'data') {
    return (
      <VStack
        spacing={6}
        modifiers={[padding({ all: 16 }), containerBackground(palette.background, 'widget')]}
      >
        <Text modifiers={[font({ size: 28 })]}>🐾</Text>
        <Text
          modifiers={[
            font({ size: 14, weight: 'semibold', design: 'rounded' }),
            foregroundColor(palette.foreground),
          ]}
        >
          {props.stateTitle}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundColor(palette.muted)]}>
          {props.stateCta}
        </Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[padding({ all: 14 }), containerBackground(palette.background, 'widget')]}
      >
        <HStack>
          <Text
            modifiers={[
              font({ size: 12, weight: 'medium', design: 'rounded' }),
              foregroundColor(palette.muted),
            ]}
          >
            {props.progressTitle}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13 }), opacity(props.isComplete ? 1 : 0.45)]}>
            {props.isComplete ? '🎉' : '🐾'}
          </Text>
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={2}>
          <Text
            modifiers={[
              font({ size: 34, weight: 'bold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.brand),
            ]}
          >
            {`${props.completedTodos}`}
          </Text>
          <Text
            modifiers={[
              font({ size: 18, weight: 'semibold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.muted),
            ]}
          >
            {`/${props.totalTodos}`}
          </Text>
          <Spacer />
        </HStack>
        <Gauge
          value={props.completionRate}
          min={0}
          max={100}
          modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 6 })]}
        />
        <HStack>
          <Text
            modifiers={[
              font({ size: 11, weight: 'medium', design: 'rounded' }),
              foregroundColor(props.isComplete ? palette.brand : palette.muted),
            ]}
          >
            {props.isComplete ? props.allDoneLabel : props.percentLabel}
          </Text>
          <Spacer />
          {props.currentStreak > 0 ? (
            <Text
              modifiers={[
                font({ size: 11, weight: 'medium', design: 'rounded' }),
                foregroundColor(palette.brand),
              ]}
            >
              {`🔥 ${props.streakLabel}`}
            </Text>
          ) : null}
        </HStack>
      </VStack>
    );
  }

  const maxRows = environment.widgetFamily === 'systemLarge' ? 8 : 3;
  const visibleTodos = props.topTodos.slice(0, maxRows);
  const overflowCount = props.totalTodos - visibleTodos.length;

  // 카테고리 컬러 체크박스(앱 홈과 동일한 시각 언어): 완료 = 채움+✓, 미완료 = 연한 틴트
  const renderRow = (todo?: { title: string; completed: boolean; color: string }) => {
    if (!todo) {
      return null;
    }
    return (
      <HStack spacing={10}>
        <ZStack modifiers={[frame({ width: 18, height: 18 })]}>
          <RoundedRectangle
            cornerRadius={5}
            modifiers={[
              foregroundColor(todo.color),
              frame({ width: 18, height: 18 }),
              opacity(todo.completed ? 1 : 0.25),
            ]}
          />
          {todo.completed ? (
            <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundColor('#FFFFFF')]}>
              ✓
            </Text>
          ) : null}
        </ZStack>
        <Text
          modifiers={[
            font({ size: 15 }),
            foregroundColor(todo.completed ? palette.muted : palette.foreground),
            opacity(todo.completed ? 0.75 : 1),
            lineLimit(1),
          ]}
        >
          {todo.title}
        </Text>
        <Spacer />
      </HStack>
    );
  };

  return (
    <VStack
      alignment="leading"
      spacing={7}
      modifiers={[padding({ all: 16 }), containerBackground(palette.background, 'widget')]}
    >
      <HStack alignment="lastTextBaseline" spacing={0}>
        <Text
          modifiers={[
            font({ size: 13, weight: 'medium', design: 'rounded' }),
            foregroundColor(palette.muted),
          ]}
        >
          {props.progressTitle}
        </Text>
        <Spacer />
        {props.isComplete ? (
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'rounded' }),
              foregroundColor(palette.brand),
            ]}
          >
            {`🎉 ${props.allDoneLabel}`}
          </Text>
        ) : (
          <Text
            modifiers={[
              font({ size: 14, weight: 'bold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.brand),
            ]}
          >
            {`${props.completedTodos}`}
          </Text>
        )}
        {props.isComplete ? null : (
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'rounded' }),
              monospacedDigit(),
              foregroundColor(palette.muted),
            ]}
          >
            {`/${props.totalTodos}`}
          </Text>
        )}
      </HStack>

      <Gauge
        value={props.completionRate}
        min={0}
        max={100}
        modifiers={[gaugeStyle('linearCapacity'), tint(palette.brand), frame({ height: 4 })]}
      />

      {renderRow(visibleTodos[0])}
      {renderRow(visibleTodos[1])}
      {renderRow(visibleTodos[2])}
      {renderRow(visibleTodos[3])}
      {renderRow(visibleTodos[4])}
      {renderRow(visibleTodos[5])}
      {renderRow(visibleTodos[6])}
      {renderRow(visibleTodos[7])}

      {overflowCount > 0 ? (
        <HStack>
          <Spacer />
          <Text modifiers={[font({ size: 11, design: 'rounded' }), foregroundColor(palette.muted)]}>
            {props.moreLabelTemplate.replace('{count}', String(overflowCount))}
          </Text>
        </HStack>
      ) : null}
      <Spacer />
    </VStack>
  );
}

/**
 * 위젯 인스턴스 (앱 프로세스에서 타임라인 갱신에 사용).
 * name은 app.config.ts expo-widgets 플러그인의 widgets[].name과 일치해야 한다.
 * iOS 외 플랫폼에서는 expo-widgets 스텁이 no-op으로 동작한다.
 */
export const aidoTodayListWidget = createWidget<IosWidgetProps>(
  'AidoTodayList',
  AidoTodayListLayout,
);
