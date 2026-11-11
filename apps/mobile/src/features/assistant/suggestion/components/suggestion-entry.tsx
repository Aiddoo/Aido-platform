import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { AiFilledIcon, LabelChip, ListRow, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { isSuggestionsPremiumRequiredError } from '../domains/suggestion.error';
import { useGetSuggestionsQueryOptions } from '../queries/suggestion.queries';

/** 피드의 선택 칸이라 조회 오류를 던지지 않고 칸 안에서 다시 시도한다. 개발 빌드 LogBox가 화면을 덮지 않게 한다 */
export function SuggestionEntry() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const userQuery = useQuery(useGetMeQueryOptions());
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());

  if (userQuery.isPending || entitlementsQuery.isPending) {
    return <SuggestionEntry.Loading />;
  }

  if (userQuery.data == null || entitlementsQuery.data == null) {
    return (
      <SuggestionEntry.Error
        error={userQuery.error ?? entitlementsQuery.error}
        reset={() => {
          userQuery.refetch();
          entitlementsQuery.refetch();
        }}
      />
    );
  }

  if (!EntitlementPolicy.canUseFeature(entitlementsQuery.data, 'AI_SUGGESTION')) {
    return (
      <InfoCard
        label={t('feed.routineSuggestion')}
        isPremiumOnly
        onPress={() => push('/suggestions')}
      />
    );
  }

  return <PremiumSuggestionEntry name={userQuery.data.name} />;
}

interface PremiumSuggestionEntryProps {
  name: string;
}

function PremiumSuggestionEntry({ name }: PremiumSuggestionEntryProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['todo', 'ai']);
  const suggestionsQuery = useQuery({ ...useGetSuggestionsQueryOptions(), throwOnError: false });

  if (isSuggestionsPremiumRequiredError(suggestionsQuery.error)) {
    return (
      <InfoCard
        label={t('ai:suggestions.toasts.premiumOnly')}
        onPress={() => push({ pathname: '/paywall', params: { feature: 'AI_SUGGESTION' } })}
      />
    );
  }

  if (suggestionsQuery.isPending) {
    return <InfoCard label={t('feed.suggestionsLoading')} />;
  }

  const suggestions = suggestionsQuery.data;
  if (!suggestions) {
    return (
      <SuggestionEntry.Error
        error={suggestionsQuery.error}
        reset={() => suggestionsQuery.refetch()}
      />
    );
  }

  const label =
    suggestions.length > 0
      ? t('feed.suggestionsArrived', { name, count: suggestions.length })
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

  return (
    <PressableFeedback className="rounded-xl bg-gray-1 px-4" {...props}>
      <ListRow
        left={<AiFilledIcon width={24} height={24} colorClassName="text-main" />}
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

SuggestionEntry.Loading = function Loading() {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.loading')} />;
};

SuggestionEntry.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.suggestionsRetry')} onPress={reset} />;
};
