// react-native-android-widget은 컴포넌트를 React 렌더러 밖에서 함수로 직접 호출한다.
// React Compiler가 주입하는 useMemoCache가 훅으로 취급되어 "Invalid hook call"로 렌더가
// 통째로 실패하므로(빈 위젯), 이 파일은 컴파일러 대상에서 제외한다.
'use no memo';

import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import { WIDGET_COLORS, type WidgetTheme } from '../constants/widget-colors.constant';
import { WIDGET_FONTS, WIDGET_MASCOT_IMAGE } from './widget-assets';

/** 선형 프로그레스 바 — flex 비율로 채움 폭을 표현한다 (RemoteViews에는 % 폭이 없음) */
export function ProgressBar({
  rate,
  theme,
  height,
}: {
  rate: number;
  theme: WidgetTheme;
  height: number;
}) {
  const palette = WIDGET_COLORS[theme];
  const fill = Math.min(100, Math.max(0, Math.round(rate)));

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height,
        backgroundColor: palette.track,
        borderRadius: height / 2,
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {fill > 0 ? (
        <FlexWidget
          style={{
            flex: fill,
            height,
            // 메인 컬러(--main) 기점 그라데이션 — 채워질수록 밝아지는 진행감
            backgroundGradient: {
              from: palette.brand,
              to: palette.brandSoft,
              orientation: 'LEFT_RIGHT',
            },
            borderRadius: height / 2,
          }}
        />
      ) : null}
      {fill < 100 ? <FlexWidget style={{ flex: 100 - fill, height }} /> : null}
    </FlexWidget>
  );
}

/** empty/loggedOut/stale 공통 상태 화면 — 고양이 마스코트 + 안내 문구 */
export function StateWidget({
  theme,
  title,
  cta,
}: {
  theme: WidgetTheme;
  title: string;
  cta: string;
}) {
  const palette = WIDGET_COLORS[theme];

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: palette.background,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexGap: 8,
      }}
    >
      <ImageWidget image={WIDGET_MASCOT_IMAGE} imageWidth={48} imageHeight={48} />
      <TextWidget
        text={title}
        style={{
          fontSize: 14,
          fontFamily: WIDGET_FONTS.semibold,
          color: palette.foreground,
          textAlign: 'center',
        }}
      />
      <TextWidget
        text={cta}
        style={{
          fontSize: 12,
          fontFamily: WIDGET_FONTS.regular,
          color: palette.muted,
          textAlign: 'center',
        }}
      />
    </FlexWidget>
  );
}
