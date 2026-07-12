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
            backgroundColor: palette.brand,
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
