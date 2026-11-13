import {
  type EntitlementSnapshot,
  EntitlementPolicy,
} from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { AiFilledIcon, LabelChip, ListRow, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';

export function SuggestionEntry() {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const [{ data: me }, { data: canUseSuggestions }] = useSuspenseQueries({
    queries: [
      useGetMeQueryOptions(),
      { ...useGetEntitlementsQueryOptions(), select: selectCanUseSuggestions },
    ],
  });

  if (!canUseSuggestions) {
    return (
      <InfoCard
        label={t('feed.routineSuggestion')}
        isPremiumOnly
        onPress={() => push('/suggestions')}
      />
    );
  }

  // 제안만 늦게 오면 "불러오는 중" 대신 제안을 기다린다는 문구를 보인다
  return (
    <Suspense fallback={<InfoCard label={t('feed.suggestionsLoading')} />}>
      <PremiumSuggestionEntry name={me.name} />
    </Suspense>
  );
}

SuggestionEntry.Loading = function Loading() {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.loading')} />;
};

SuggestionEntry.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'ai']);
  const push = useSingleTap(router.push);

  // 한도 스냅샷이 늦어 프리미엄으로 보였지만 서버는 거절했다. 다시 시도 대신 결제 화면으로 보낸다
  if (isSuggestionsPremiumRequiredError(error)) {
    return (
      <InfoCard
        label={t('ai:suggestions.toasts.premiumOnly')}
        onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } })}
      />
    );
  }

  return <InfoCard label={t('todo:feed.suggestionsRetry')} onPress={reset} />;
};

interface PremiumSuggestionEntryProps {
  name: string;
}

function PremiumSuggestionEntry({ name }: PremiumSuggestionEntryProps) {
  const { t } = useTranslation('todo');
  const push = useSingleTap(router.push);
  const { data: suggestionCount } = useSuspenseQuery({
    ...useGetSuggestionsQueryOptions(),
    select: (suggestions) => suggestions.length,
  });

  const label =
    suggestionCount > 0
      ? t('feed.suggestionsArrived', { name, count: suggestionCount })
      : t('feed.preparing');

  return <InfoCard label={label} onPress={() => push('/suggestions')} />;
}

interface InfoCardProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  /** 무료 사용자가 눌러 보기 전에 프리미엄 기능임을 알린다 */
  isPremiumOnly?: boolean;
}

function InfoCard({ label, isPremiumOnly = false, ...props }: InfoCardProps) {
  const { t } = useTranslation('subscription');
  const fontScaledSize = useFontScaledSize();

  return (
    <PressableFeedback className="rounded-xl bg-gray-1 px-4" {...props}>
      <ListRow
        left={
          <AiFilledIcon
            width={fontScaledSize(24)}
            height={fontScaledSize(24)}
            colorClassName="text-main"
          />
        }
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{ size: 'b3', weight: 'medium', shade: 8 }}
          />
        }
        right={
          isPremiumOnly && (
            // Chip도 Pressable이라 그대로 두면 칩 자리 탭을 가로채 카드가 눌리지 않는다
            <LabelChip
              color="accent"
              label={t('tier.premium')}
              labelProps={{ weight: 'semibold', numberOfLines: 1 }}
              pointerEvents="none"
            />
          )
        }
      />
    </PressableFeedback>
  );
}

function selectCanUseSuggestions(snapshot: EntitlementSnapshot) {
  return EntitlementPolicy.canUseFeature(snapshot, 'AI_SUGGESTION');
}
