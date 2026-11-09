import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FeatureMedia,
  HStack,
  type QueryErrorFallbackProps,
  QueryErrorFallback,
  Steps,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { clamp } from 'es-toolkit';
import { Skeleton } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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

/** 그림에 구운 바탕색과 같은 토큰이라 그림 가장자리가 카드에 묻힌다(다크 모드에서도 같은 #424242) */
const SLIDE_TONE_CLASS_NAMES = {
  brand: 'bg-main',
  dark: 'bg-gray-9 dark:bg-gray-2',
} as const satisfies Record<BenefitSlideTone, string>;

/** 페이월 맨 위 AI 혜택 넘기기. 막혀서 들어온 기능의 장부터 보여 주고 저절로 넘기지 않는다 */
export function BenefitCarousel() {
  const [{ feature }] = useSubscriptionParams();
  const [index, setIndex] = useState(() => getInitialBenefitIndex(BENEFIT_SLIDES, feature));
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  useTrackBenefitViewed(index);

  const handleLayout = (event: LayoutChangeEvent) => {
    setPageWidth(event.nativeEvent.layout.width);
  };

  return (
    <VStack gap={12}>
      <Box onLayout={handleLayout}>
        {pageWidth == null ? (
          // 폭을 재기 전에도 같은 장을 그려 넘기기 목록이 들어와도 높이가 밀리지 않는다
          <BenefitSlideCard slide={BENEFIT_SLIDES[index] ?? BENEFIT_SLIDES[0]} number={index + 1} />
        ) : (
          <BenefitPager
            key={pageWidth}
            pageWidth={pageWidth}
            index={index}
            onIndexChange={setIndex}
          />
        )}
      </Box>

      <HStack justify="center">
        <Steps.Dots index={index} count={BENEFIT_SLIDES.length} />
      </HStack>
    </VStack>
  );
}

interface BenefitPagerProps {
  pageWidth: number;
  index: number;
  onIndexChange: (index: number) => void;
}

/** calendar-pager와 같은 넘기기. 장마다 높이가 달라도 목록 줄 높이는 가장 큰 장을 따른다 */
function BenefitPager({ pageWidth, index, onIndexChange }: BenefitPagerProps) {
  // 폭이 바뀌어 새 목록을 만들 때만 지금 장을 시작 위치로 읽는다
  const [initialContentOffset] = useState(() => ({ x: index * pageWidth, y: 0 }));
  const [initialIndex] = useState(index);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    onIndexChange(
      clamp(Math.round(contentOffset.x / layoutMeasurement.width), 0, BENEFIT_SLIDES.length - 1),
    );
  };

  return (
    <FlatList
      horizontal
      pagingEnabled
      data={BENEFIT_SLIDES}
      keyExtractor={(slide) => slide.feature}
      renderItem={({ item: slide, index: slideIndex }) => (
        <Box className="flex-1" style={{ width: pageWidth }}>
          <BenefitSlideCard slide={slide} number={slideIndex + 1} className="flex-1" />
        </Box>
      )}
      getItemLayout={(_, itemIndex) => ({
        length: pageWidth,
        offset: pageWidth * itemIndex,
        index: itemIndex,
      })}
      initialScrollIndex={initialIndex}
      contentOffset={initialContentOffset}
      initialNumToRender={BENEFIT_SLIDES.length}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={handleScrollEnd}
      testID="paywall-benefit-pager"
    />
  );
}

interface BenefitSlideCardProps {
  slide: BenefitSlideEntry;
  /** "혜택 N" 칩 번호. 1부터 */
  number: number;
  className?: string;
}

function BenefitSlideCard({ slide, number, className }: BenefitSlideCardProps) {
  const { t } = useTranslation('subscription');
  const { title, description } = useBenefitSlideText(slide.feature);

  return (
    <VStack
      justify="between"
      className={cn('overflow-hidden rounded-3xl', SLIDE_TONE_CLASS_NAMES[slide.tone], className)}
      testID={`paywall-benefit-${slide.feature}`}
    >
      <VStack gap={8} className="px-5 pt-5">
        <Box className="self-start rounded-full bg-on-sky/20 px-2.5 py-1">
          <Text size="e1" weight="semibold" tone="onSky">
            {t('paywall.benefitChip', { index: number })}
          </Text>
        </Box>

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

      <FeatureMedia source={slide.image} alt="" ratio={BENEFIT_ART_RATIO} />
    </VStack>
  );
}

function BenefitQuota({ feature }: Pick<BenefitSlideEntry, 'feature'>) {
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

function useBenefitSlideText(feature: BenefitSlideEntry['feature']) {
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
  const { trackEvent } = useTrack();
  const trackedIndexesRef = useRef(new Set<number>());

  useEffect(() => {
    const slide = BENEFIT_SLIDES[index];
    if (slide == null || trackedIndexesRef.current.has(index)) {
      return;
    }
    trackedIndexesRef.current.add(index);
    trackEvent('paywall_benefit_viewed', {
      feature: getPremiumGateAnalyticsFeature(slide.feature),
      index: index + 1,
    });
  }, [index, trackEvent]);
}

BenefitCarousel.Loading = function Loading() {
  return (
    <VStack gap={12} accessibilityState={{ busy: true }}>
      <VStack className="overflow-hidden rounded-3xl bg-gray-2">
        <VStack gap={8} className="px-5 pt-5">
          <TextSkeleton size="e1" className="w-14" />
          <TextSkeleton size="t3" className="w-48" />
          <TextSkeleton size="b4" className="w-56" />
          <TextSkeleton size="b4" className="w-40" />
        </VStack>
        <Skeleton className="w-full" style={{ aspectRatio: BENEFIT_ART_RATIO }} />
      </VStack>

      <HStack justify="center">
        <Steps.Dots index={0} count={BENEFIT_SLIDES.length} />
      </HStack>
    </VStack>
  );
};

BenefitCarousel.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback className="py-4" illustrationSize="block" reset={reset} />;
};
