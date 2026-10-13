import { useTranslation } from '@src/shared/i18n';
import { H3, Text, VStack } from '@src/shared/ui';
import { type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

/** 상장 느낌의 이중 SVG 라운드 테두리 */
function CertificateBorder({ children }: { children: ReactNode }) {
  const { color: strokeColor } = useResolveClassNames('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const { width: w, height: h } = size;

  return (
    <View className="relative" onLayout={onLayout}>
      {w > 0 && h > 0 && (
        <View className="absolute inset-0">
          <Svg width={w} height={h}>
            <Rect
              x={2}
              y={2}
              width={w - 4}
              height={h - 4}
              rx={2}
              ry={2}
              stroke={strokeColor as string}
              strokeWidth={1.5}
              fill="none"
              strokeOpacity={0.6}
            />
            <Rect
              x={7}
              y={7}
              width={w - 14}
              height={h - 14}
              rx={1}
              ry={1}
              stroke={strokeColor as string}
              strokeWidth={0.5}
              fill="none"
              strokeOpacity={0.35}
            />
          </Svg>
        </View>
      )}
      <View className="m-2">{children}</View>
    </View>
  );
}

/** 주간 달성 배지 상장. 머리말·제목·부제목과 이중 테두리를 고정하고 본문만 children으로 받는다. */
export function Certificate({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation('achievement');

  return (
    <View className="bg-white rounded-sm overflow-hidden p-3">
      <CertificateBorder>
        <View className="px-5 pt-7 pb-5">
          <VStack align="center" gap={4}>
            <Text size="e1" tone="brand" className="tracking-widest">
              {t('card.eyebrow')}
            </Text>
            <H3 className="tracking-wider">{t('card.title')}</H3>
            {subtitle != null && (
              <Text size="b4" shade={6} weight="medium">
                {subtitle}
              </Text>
            )}
          </VStack>
          {children}
        </View>
      </CertificateBorder>
    </View>
  );
}

Certificate.Ornament = function Ornament() {
  return (
    <Text tone="brand" align="center">
      {'── ✦ ──'}
    </Text>
  );
};
