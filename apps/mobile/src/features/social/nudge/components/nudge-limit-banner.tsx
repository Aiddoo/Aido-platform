import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useFormatRefillSentence } from '@src/features/billing/subscription/hooks/use-format-refill-sentence';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { Trans, useTranslation } from '@src/shared/i18n';
import {
  HStack,
  PawIcon,
  Text,
  TextSkeleton,
  VStack,
  type QueryErrorFallbackProps,
  Image,
  QueryErrorFallback,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { match } from 'ts-pattern';

/** 남은 횟수·초기화 시각은 서버 권한 스냅샷(NUDGE) 하나가 원본이다. 지난 초기화 시각의 0은 믿지 않는다 */
export function NudgeLimitBanner() {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const gate = useEntitlementGate('NUDGE', { surface: 'poke_banner' });
  const formatRefillSentence = useFormatRefillSentence();
  const now = useMinuteNow();

  const quota = EntitlementPolicy.getQuotaStatus(entitlements, 'NUDGE', now);
  const isReached = quota.type === 'used-up';
  const usedToday = EntitlementPolicy.getUsedCount(entitlements, 'NUDGE');
  const refill = formatRefillSentence(entitlements, 'NUDGE');

  const defaultTitle = (
    <Trans
      t={t}
      i18nKey="nudge.prompt"
      components={{ highlight: <Text size="b3" weight="bold" className="text-main" /> }}
    />
  );

  const hint = {
    title: defaultTitle,
    description: (
      <HStack gap={2} align="center" className="flex-wrap">
        <Text size="e1" shade={6}>
          {t('nudge.hintPrefix')}
        </Text>
        <PawIcon
          width={fontScaledSize(14)}
          height={fontScaledSize(14)}
          colorClassName="text-main"
        />
        <Text size="e1" shade={6}>
          {t('nudge.hintSuffix')}
        </Text>
      </HStack>
    ),
  };

  const bannerText = match(quota)
    .with({ type: 'used-up' }, () => ({
      title: t('nudge.limitSpentTitle'),
      description: refill != null && (
        <Text size="e1" shade={6}>
          {refill}
        </Text>
      ),
    }))
    .with({ type: 'remaining' }, ({ count }) =>
      usedToday === 0
        ? hint
        : {
            title: defaultTitle,
            description: (
              <Text size="e1" shade={6}>
                {t('nudge.remaining', { count })}
              </Text>
            ),
          },
    )
    .with({ type: 'untracked' }, () => hint)
    .exhaustive();

  return (
    <PressableFeedback
      onPress={() => gate.promptIfBlocked()}
      isDisabled={!isReached}
      className="rounded-xl"
    >
      <HStack className="rounded-xl bg-gray-1 px-3" align="center" gap={12}>
        <Image
          source={isReached ? aidoNoBannerImage : aidoBannerImage}
          className="size-[72px]"
          contentFit="contain"
        />
        <VStack flex={1}>
          <Text size="b3" weight="medium">
            {bannerText.title}
          </Text>
          {bannerText.description}
        </VStack>
      </HStack>
    </PressableFeedback>
  );
}

NudgeLimitBanner.Loading = function Loading() {
  return (
    <HStack className="rounded-xl bg-gray-1 px-3" align="center" gap={12}>
      <Skeleton className="size-[72px] rounded-xl" />
      <VStack flex={1}>
        <TextSkeleton size="b3" className="w-3/4" />
        <TextSkeleton size="e1" className="w-1/2" />
      </VStack>
    </HStack>
  );
};

NudgeLimitBanner.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);
  return (
    <QueryErrorFallback.Inline
      message={t('todo:nudge.statusUnavailable')}
      reset={reset}
      className="rounded-xl bg-gray-1 p-3"
    />
  );
};
