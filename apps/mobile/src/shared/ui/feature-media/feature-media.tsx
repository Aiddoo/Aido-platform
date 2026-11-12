import { ANIMATION } from '@src/shared/constants/animation';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { cn } from '@src/shared/utils/cn';
import { Image, type ImageProps } from 'expo-image';
import { Skeleton } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { match } from 'ts-pattern';

import { AspectRatio, type AspectRatioProps } from '../aspect-ratio';

type MediaStatus = 'loading' | 'loaded' | 'failed';

export interface FeatureMediaProps extends Omit<AspectRatioProps, 'children'> {
  source: NonNullable<ImageProps['source']>;
  /** 스크린 리더가 읽는 설명. 장식이면 빈 문자열 */
  alt: string;
  contentFit?: ImageProps['contentFit'];
  /** 목록 재활용 때 이전 행 이미지가 비치지 않게 행마다 다른 값을 넘긴다 */
  recyclingKey?: string;
  /** 불러오지 못했을 때 같은 자리에 그릴 것. 없으면 빈 표면 */
  fallback?: ReactNode;
}

/**
 * 비율이 고정된 이미지 자리. 받기 전에 같은 자리에 스켈레톤을 두어 화면이 밀리지 않는다.
 * 디스크·메모리 캐시를 함께 쓰고, 화면 크기에 맞춰 줄여 디코딩한다.
 */
export function FeatureMedia({
  source,
  alt,
  contentFit = 'cover',
  recyclingKey,
  fallback,
  className,
  ...props
}: FeatureMediaProps) {
  // 앱에 묶인 그림(require)은 곧바로 그려져 카드 위에 회색 스켈레톤·바탕이 번쩍이지 않게 처음부터 그린 것으로 본다
  const isBundled = typeof source === 'number';
  const [status, setStatus] = useState<MediaStatus>(isBundled ? 'loaded' : 'loading');
  const isReducedMotion = useIsReduceMotionEnabled();

  return (
    <AspectRatio className={cn('overflow-hidden', !isBundled && 'bg-gray-2', className)} {...props}>
      <Image
        source={source}
        alt={alt}
        accessible={alt !== ''}
        accessibilityRole="image"
        contentFit={contentFit}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        transition={isReducedMotion || isBundled ? 0 : ANIMATION.durationMs.normal}
        style={StyleSheet.absoluteFill}
        onLoadStart={() => {
          if (!isBundled) {
            setStatus('loading');
          }
        }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
      />
      {match(status)
        .with('loading', () => (
          <Skeleton
            variant={isReducedMotion ? 'none' : 'shimmer'}
            className="rounded-none dark:bg-gray-2"
            style={StyleSheet.absoluteFill}
          />
        ))
        .with('failed', () => (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="items-center justify-center bg-gray-2"
            style={StyleSheet.absoluteFill}
          >
            {fallback}
          </View>
        ))
        .with('loaded', () => null)
        .exhaustive()}
    </AspectRatio>
  );
}
