import { useFontScale } from '@src/shared/providers/font-scale-provider';
import type { TextSize } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { useResolveClassNames } from 'uniwind';

/** 시안 V2Spec §6: 한 줄에 맞추려고 줄이더라도 11pt 아래로는 줄이지 않는다. */
const MIN_FONT_SIZE = 11;

/**
 * 앱 글자 크기 설정의 배율(보통=1). Text는 시스템 글꼴 배율을 쓰지 않으므로
 * 아이콘·고정 폭·큰 글자 배치도 이 배율 하나로 맞춘다.
 */
export function useFontScaleRatio(): number {
  const { fontScale } = useFontScale();
  return getScaledFontSize(fontScale) / getScaledFontSize('medium');
}

/**
 * adjustsFontSizeToFit의 minimumFontScale. 토큰은 앱 글자 크기로 바뀐 실제 크기,
 * 숫자(토큰이 없는 시안 크기 px)는 앱 배율을 곱한 크기를 기준으로 11pt까지만 줄인다.
 */
export function useMinimumFontScale(size: TextSize | number): number {
  const { resolveSize } = useFontScale();
  const ratio = useFontScaleRatio();
  const { fontSize: tokenFontSize } = useResolveClassNames(
    typeof size === 'number' ? '' : `text-${resolveSize(size)}`,
  );
  const fontSize = typeof size === 'number' ? size * ratio : tokenFontSize;
  return typeof fontSize === 'number' && fontSize > MIN_FONT_SIZE ? MIN_FONT_SIZE / fontSize : 1;
}
