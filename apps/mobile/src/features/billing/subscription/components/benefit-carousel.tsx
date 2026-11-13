import { useTrackView } from '@src/shared/analytics';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FeatureMedia,
  HStack,
  type QueryErrorFallbackProps,
  QueryErrorFallback,
  READABLE_CONTENT_MAX_WIDTH,
  Steps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { clamp } from 'es-toolkit';
import { Chip, Skeleton } from 'heroui-native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { type FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

import { BENEFIT_SLIDES, type BenefitSlideTone } from '../constants/subscription.constants';
import { useFormatPlanValue } from '../hooks/use-format-plan-value';
import { useSubscriptionParams } from '../hooks/use-subscription-params';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { getInitialBenefitIndex } from '../utils/benefit-slides.view-model';
import { toBenefitQuotaLabel } from '../utils/plan-benefit.view-model';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';

const BENEFIT_ART_RATIO = 1372 / 560;

type BenefitSlideEntry = (typeof BENEFIT_SLIDES)[number];
type BenefitFeature = BenefitSlideEntry['feature'];

/** 그림에 구운 바탕색과 같은 토큰이라 그림 가장자리가 카드에 묻힌다(다크 모드에서도 같은 #424242) */
const SLIDE_TONE_CLASS_NAMES = {
  brand: 'bg-main',
  dark: 'bg-gray-9 dark:bg-gray-2',
} as const satisfies Record<BenefitSlideTone, string>;

/** 결제 화면 좌우 여백(16)과 영수증 카드 안 여백(20). 첫 프레임 예상 폭에만 쓰고 실제 폭은 재서 맞춘다 */
const SCREEN_GUTTER = 16 * 2;
const CARD_GUTTER = 20 * 2;

/** 첫 프레임부터 넘기기 목록을 그려 폭을 잰 뒤 단일 카드에서 목록으로 바뀌며 그림이 다시 붙지 않게 한다. 넓은 창은 결제 화면이 읽기 폭으로 모은다 */
function useEstimatedPageWidth() {
  const { width: frameWidth } = useSafeAreaFrame();
  const { left, right } = useSafeAreaInsets();
  const contentWidth = Math.min(
    frameWidth - left - right - SCREEN_GUTTER,
    READABLE_CONTENT_MAX_WIDTH,
  );

  return Math.max(0, contentWidth - CARD_GUTTER);
}

/** 페이월 맨 위 AI 혜택 넘기기. 막혀서 들어온 기능의 장부터 보여 주고 저절로 넘기지 않는다 */
export function BenefitCarousel() {
  const [{ feature }] = useSubscriptionParams();
  const [index, setIndex] = useState(() => getInitialBenefitIndex(BENEFIT_SLIDES, feature));
  const estimatedPageWidth = useEstimatedPageWidth();
  const [measuredSize, handleLayout] = useLayoutSize();
  const pageWidth = measuredSize?.width ?? estimatedPageWidth;
  const progress = useSharedValue(index);
  useTrackBenefitViewed(index);

  return (
    <Box onLayout={handleLayout}>
      <BenefitPager
        pageWidth={pageWidth}
        index={index}
        progress={progress}
        onIndexChange={setIndex}
      />
      {/* 작은 화면에서도 첫 화면에 넘길 장이 더 있다는 것이 보이게 카드 안에 둔다. 그림 위는 밝은 그림에 반투명 흰 점이 묻혀 "혜택 N" 칩 줄 오른쪽 색 면에 얹는다 */}
      <HStack pointerEvents="none" className="absolute top-4 right-5">
        <Steps.Dots
          index={index}
          count={BENEFIT_SLIDES.length}
          progress={progress}
          tone="onMedia"
        />
      </HStack>
    </Box>
  );
}

interface BenefitPagerProps {
  pageWidth: number;
  index: number;
  /** 넘기는 동안 점 표시가 따라오도록 UI 스레드에서 장 위치를 적는다 */
  progress: SharedValue<number>;
  /** 분석·접근성용 장 번호는 넘기기가 멈출 때만 바꾼다 */
  onIndexChange: (index: number) => void;
}

/** calendar-pager와 같은 넘기기. 카드 높이는 내용으로 정하고, 글 길이가 장마다 달라 가장 긴 글 높이에 맞춘다 */
function BenefitPager({ pageWidth, index, progress, onIndexChange }: BenefitPagerProps) {
  const listRef = useRef<FlatList<BenefitSlideEntry>>(null);
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (pageWidth > 0) {
        progress.set(event.contentOffset.x / pageWidth);
      }
    },
  });
  const [initialIndex] = useState(index);
  const copyHeightsRef = useRef(new Map<BenefitFeature, number>());
  const [copyMinHeight, setCopyMinHeight] = useState(0);

  // 폭이 바뀌어도(예상 폭 → 잰 폭, 접기·회전) 목록을 다시 만들지 않고 보던 장에 맞춘다
  const keepIndexOnResize = useEffectEvent(() => {
    listRef.current?.scrollToOffset({ offset: index * pageWidth, animated: false });
  });
  useEffect(() => {
    keepIndexOnResize();
  }, [pageWidth]);

  // 네 장을 다 잰 뒤 한 번에 맞춰 장마다 목록 전체를 다시 그리지 않는다
  const handleCopyLayout = (feature: BenefitFeature, height: number) => {
    const heights = copyHeightsRef.current;
    heights.set(feature, height);
    if (heights.size < BENEFIT_SLIDES.length) {
      return;
    }
    const maxHeight = Math.max(...heights.values());
    setCopyMinHeight((current) => (current === maxHeight ? current : maxHeight));
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    onIndexChange(
      clamp(Math.round(contentOffset.x / layoutMeasurement.width), 0, BENEFIT_SLIDES.length - 1),
    );
  };

  return (
    <Animated.FlatList
      ref={listRef}
      horizontal
      pagingEnabled
      data={BENEFIT_SLIDES}
      keyExtractor={(slide) => slide.feature}
      extraData={`${copyMinHeight}:${pageWidth}`}
      renderItem={({ item: slide, index: slideIndex }) => (
        <Box style={{ width: pageWidth }}>
          <BenefitSlideCard
            slide={slide}
            number={slideIndex + 1}
            copyMinHeight={copyMinHeight}
            onCopyLayout={(height) => handleCopyLayout(slide.feature, height)}
          />
        </Box>
      )}
      getItemLayout={(_, itemIndex) => ({
        length: pageWidth,
        offset: pageWidth * itemIndex,
        index: itemIndex,
      })}
      initialScrollIndex={initialIndex}
      initialNumToRender={BENEFIT_SLIDES.length}
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onMomentumScrollEnd={handleScrollEnd}
      testID="paywall-benefit-pager"
    />
  );
}

interface BenefitSlideCardProps {
  slide: BenefitSlideEntry;
  /** "혜택 N" 칩 번호. 1부터 */
  number: number;
  /** 넘기는 장들의 글 칸을 가장 긴 장에 맞춰 그림 위치가 같게 한다 */
  copyMinHeight?: number;
  /** 늘리기 전 글 칸의 높이 */
  onCopyLayout?: (height: number) => void;
}

function BenefitSlideCard({ slide, number, copyMinHeight, onCopyLayout }: BenefitSlideCardProps) {
  const { t } = useTranslation('subscription');
  const { title, description } = useBenefitSlideText(slide.feature);

  return (
    <VStack
      className={cn('overflow-hidden rounded-3xl', SLIDE_TONE_CLASS_NAMES[slide.tone])}
      testID={`paywall-benefit-${slide.feature}`}
    >
      <Box style={{ minHeight: copyMinHeight }}>
        <VStack
          gap={8}
          className="px-5 pt-5"
          onLayout={(event) => onCopyLayout?.(event.nativeEvent.layout.height)}
        >
          <Chip size="sm" pointerEvents="none" className="self-start bg-on-sky/20">
            <Text size="e1" weight="semibold" tone="onSky">
              {t('paywall.benefitChip', { index: number })}
            </Text>
          </Chip>

          <VStack gap={2}>
            <Text size="t3" weight="bold" tone="onSky" lineBreakStrategyIOS="hangul-word">
              {title}
            </Text>
            <Text size="b4" tone="onSky" lineBreakStrategyIOS="hangul-word" className="opacity-90">
              {description}
            </Text>
          </VStack>

          <BenefitQuota feature={slide.feature} />
        </VStack>
      </Box>

      <FeatureMedia source={slide.image} alt="" ratio={BENEFIT_ART_RATIO} />
    </VStack>
  );
}

function BenefitQuota({ feature }: { feature: BenefitFeature }) {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const formatPlanValue = useFormatPlanValue();

  return (
    <Box className="self-start rounded-xl bg-on-sky/15 px-3 py-1.5">
      <Text size="b4" weight="semibold" tone="onSky" lineBreakStrategyIOS="hangul-word">
        {match(toBenefitQuotaLabel(entitlements, feature))
          .with({ type: 'premiumOnly' }, () => t('paywall.premiumOnly'))
          .with({ type: 'upgrade' }, ({ free, premium }) =>
            t('paywall.benefitQuota', {
              free: formatPlanValue(free),
              premium: formatPlanValue(premium),
            }),
          )
          .exhaustive()}
      </Text>
    </Box>
  );
}

function useBenefitSlideText(feature: BenefitFeature) {
  const { t } = useTranslation('subscription');

  return match(feature)
    .with('AI_PARSE', () => ({
      title: t('benefitSlides.aiParse.title'),
      description: t('benefitSlides.aiParse.description'),
    }))
    .with('AI_REPORT', () => ({
      title: t('benefitSlides.aiReport.title'),
      description: t('benefitSlides.aiReport.description'),
    }))
    .with('AI_SUGGESTION', () => ({
      title: t('benefitSlides.aiSuggestion.title'),
      description: t('benefitSlides.aiSuggestion.description'),
    }))
    .with('VOICE_NOTE', () => ({
      title: t('benefitSlides.voiceNote.title'),
      description: t('benefitSlides.voiceNote.description'),
    }))
    .exhaustive();
}

/** 넘겨서 본 장마다 한 번만 센다. 처음 보인 장도 센다 */
function useTrackBenefitViewed(index: number) {
  const slide = BENEFIT_SLIDES[index];

  useTrackView(
    'paywall_benefit_viewed',
    slide == null
      ? null
      : {
          key: String(index),
          params: { feature: getPremiumGateAnalyticsFeature(slide.feature), index: index + 1 },
        },
  );
}

BenefitCarousel.Loading = function Loading() {
  // 다크에서 카드 바탕(gray-2)과 기본 글 스켈레톤 색이 같아 한 단계 밝은 색으로 그린다
  const color = useResolvedColor('text-gray-3');

  return (
    <VStack accessibilityState={{ busy: true }} className="overflow-hidden rounded-3xl bg-gray-2">
      <VStack gap={8} className="px-5 pt-5">
        <TextSkeleton size="e1" color={color} className="w-14" />
        <TextSkeleton size="t3" color={color} className="w-48" />
        <TextSkeleton size="b4" color={color} className="w-56" />
        <TextSkeleton size="b4" color={color} className="w-40" />
      </VStack>
      <Skeleton className="w-full" style={{ aspectRatio: BENEFIT_ART_RATIO }} />
    </VStack>
  );
};

BenefitCarousel.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback className="py-4" illustrationSize="block" reset={reset} />;
};
