import aidoBannerImage from '@assets/images/aido_banner.webp';
import aidoNoBannerImage from '@assets/images/aido_no_banner.webp';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useFormatRefillSentence } from '@src/features/billing/subscription/hooks/use-format-refill-sentence';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useTranslation } from '@src/shared/i18n';
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
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { match, P } from 'ts-pattern';

import { NudgeLimitPolicy } from '../domains/todo-nudge.model';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/todo-nudge.queries';

export function NudgeLimitBanner() {
  const { t } = useTranslation('todo');
  const { data: limitInfo } = useSuspenseQuery(useGetTodoNudgeLimitQueryOptions());
  const isLimitReached = NudgeLimitPolicy.isLimitReached(limitInfo);

  const gate = useEntitlementGate('NUDGE', { surface: 'poke_banner' });
  // 다시 생기는 때는 서버 한도 스냅샷이 원본이다. 아직 없으면 제목만 보인다
  const { data: entitlements } = useQuery(useGetEntitlementsQueryOptions());
  const formatRefillSentence = useFormatRefillSentence();
  const refill = formatRefillSentence(entitlements, 'NUDGE');

  const defaultTitle = (
    <>
      {t('nudge.promptPrefix')}{' '}
      <Text size="b3" weight="bold" className="text-main">
        {t('nudge.promptHighlight')}
      </Text>{' '}
      {t('nudge.promptSuffix')}
    </>
  );

  const hint = {
    title: defaultTitle,
    description: (
      <HStack gap={2} align="center" className="flex-wrap">
        <Text size="e1" shade={6}>
          {t('nudge.hintPrefix')}
        </Text>
        <PawIcon width={14} height={14} colorClassName="text-main" />
        <Text size="e1" shade={6}>
          {t('nudge.hintSuffix')}
        </Text>
      </HStack>
    ),
  };

  const bannerText = match({ ...limitInfo, isLimitReached })
    .with({ isLimitReached: true }, () => ({
      title: t('nudge.limitSpentTitle'),
      description: refill != null && (
        <Text size="e1" shade={6}>
          {refill}
        </Text>
      ),
    }))
    .with({ isUnlimited: true }, { usedToday: 0 }, () => hint)
    .with({ remainingToday: P.number }, ({ remainingToday }) => ({
      title: defaultTitle,
      description: (
        <Text size="e1" shade={6}>
          {t('nudge.remaining', { count: remainingToday })}
        </Text>
      ),
    }))
    .otherwise(() => hint);

  return (
    <PressableFeedback
      onPress={() => gate.promptIfBlocked()}
      isDisabled={!isLimitReached}
      className="rounded-xl"
    >
      <HStack className="rounded-xl bg-gray-1 px-3" align="center" gap={12}>
        <Image
          source={isLimitReached ? aidoNoBannerImage : aidoBannerImage}
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
