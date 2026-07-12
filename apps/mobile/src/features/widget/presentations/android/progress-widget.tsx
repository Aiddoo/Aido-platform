import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import {
  badgeTierOf,
  type WidgetRenderState,
  type WidgetSnapshot,
} from '../../models/widget-snapshot.model';
import { WIDGET_COLORS, type WidgetTheme } from '../constants/widget-colors.constant';
import { WIDGET_BADGE_IMAGES, WIDGET_FONTS } from './widget-assets';

export interface AndroidWidgetProps {
  snapshot: WidgetSnapshot;
  theme: WidgetTheme;
  renderState: WidgetRenderState;
}

/**
 * 진행률 위젯 (2x2~4x2) — "숫자가 주인공" 원칙.
 * 브랜드 오렌지는 프로그레스 필과 스트릭에만 사용한다.
 */
export function ProgressWidget({ snapshot, theme, renderState }: AndroidWidgetProps) {
  const palette = WIDGET_COLORS[theme];

  if (renderState !== 'data') {
    return (
      <StateWidget
        theme={theme}
        title={
          renderState === 'loggedOut'
            ? snapshot.strings.loggedOutTitle
            : renderState === 'stale'
              ? snapshot.strings.staleTitle
              : snapshot.strings.emptyTitle
        }
        cta={
          renderState === 'loggedOut'
            ? snapshot.strings.loggedOutCta
            : renderState === 'stale'
              ? snapshot.strings.staleCta
              : snapshot.strings.emptyCta
        }
      />
    );
  }

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
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TextWidget
          text={snapshot.strings.progressTitle}
          style={{
            fontSize: 12,
            fontFamily: WIDGET_FONTS.medium,
            color: palette.muted,
          }}
        />
        <ImageWidget
          image={WIDGET_BADGE_IMAGES[badgeTierOf(snapshot)]}
          imageWidth={28}
          imageHeight={28}
        />
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 4 }}>
        <TextWidget
          text={snapshot.strings.progressLabel}
          style={{
            fontSize: 24,
            fontFamily: WIDGET_FONTS.bold,
            color: palette.foreground,
          }}
        />
        {snapshot.currentStreak > 0 ? (
          <TextWidget
            text={`🔥 ${snapshot.strings.streakLabel}`}
            style={{
              fontSize: 12,
              fontFamily: WIDGET_FONTS.medium,
              color: palette.brand,
            }}
          />
        ) : null}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 6 }}>
        <ProgressBar rate={snapshot.completionRate} theme={theme} height={8} />
        <TextWidget
          text={snapshot.isComplete ? snapshot.strings.allDoneLabel : snapshot.strings.percentLabel}
          style={{
            fontSize: 11,
            fontFamily: WIDGET_FONTS.medium,
            color: snapshot.isComplete ? palette.brand : palette.muted,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

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
      <ImageWidget image={WIDGET_BADGE_IMAGES.mascot} imageWidth={48} imageHeight={48} />
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
