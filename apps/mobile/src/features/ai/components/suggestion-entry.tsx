import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { subscriptionHref } from '@src/features/subscription/utils/navigation/subscription-href';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { AiIcon, ListRow, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import {
  isSuggestionsPremiumRequiredError,
  useGetSuggestionsQueryOptions,
} from '../queries/get-suggestions-query-options';

/**
 * 피드 맨 아래의 있어도 되고 없어도 되는 칸이라 조회 오류를 던지지 않고 이 칸 안에서 다시 시도하게 한다.
 * 개발 빌드는 경계가 잡은 렌더 오류도 LogBox 전체 화면으로 보여 주므로 API 오류가 화면을 덮지 않게 한다.
 */
export function SuggestionEntry() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const userQuery = useQuery({ ...useGetMeQueryOptions(), throwOnError: false });
  const entitlementsQuery = useQuery({
    ...useGetEntitlementsQueryOptions(),
    throwOnError: false,
  });

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

  if (EntitlementPolicy.isFeatureLocked(entitlementsQuery.data, 'AI_SUGGESTION')) {
    return <InfoCard label={t('feed.routineSuggestion')} onPress={() => push('/suggestions')} />;
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
        onPress={() => push(subscriptionHref())}
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
}

function InfoCard({ label, ...props }: InfoCardProps) {
  return (
    <PressableFeedback className="rounded-xl bg-gray-1 px-4" {...props}>
      <ListRow
        left={<AiIcon width={24} height={24} colorClassName="text-main" />}
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{ size: 'b3', weight: 'medium', shade: 8 }}
          />
        }
      />
    </PressableFeedback>
  );
}

SuggestionEntry.Loading = function Loading() {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.loading')} />;
};

SuggestionEntry.Error = function ErrorState({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todo');
  return <InfoCard label={t('feed.suggestionsRetry')} onPress={reset} />;
};
