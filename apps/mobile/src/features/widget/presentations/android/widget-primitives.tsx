'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { WIDGET_COLORS, type WidgetTheme } from '../constants/widget-colors.constant';
import { WIDGET_FONTS } from './widget-assets';

const FIXED_TEXT_SCALE = false;

/** 선형 프로그레스 바 — iOS linearCapacity와 같은 단색 브랜드 fill. */
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

/** empty/loggedOut/stale 공통 상태 화면 — iOS와 동일한 발자국과 문구 위계. */
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
      accessibilityLabel={`${title}. ${cta}`}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: palette.background,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexGap: 6,
      }}
    >
      <TextWidget text="🐾" allowFontScaling={FIXED_TEXT_SCALE} style={{ fontSize: 28 }} />
      <TextWidget
        text={title}
        maxLines={1}
        allowFontScaling={FIXED_TEXT_SCALE}
        style={{
          fontSize: 14,
          fontFamily: WIDGET_FONTS.semibold,
          color: palette.foreground,
          textAlign: 'center',
          adjustsFontSizeToFit: true,
        }}
      />
      <TextWidget
        text={cta}
        maxLines={1}
        allowFontScaling={FIXED_TEXT_SCALE}
        style={{
          fontSize: 12,
          fontFamily: WIDGET_FONTS.regular,
          color: palette.muted,
          textAlign: 'center',
          adjustsFontSizeToFit: true,
        }}
      />
    </FlexWidget>
  );
}
