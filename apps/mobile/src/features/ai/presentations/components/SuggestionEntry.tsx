import MagicIcon from '@assets/icons/ic_magic.svg';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ListRow, QueryErrorBoundary, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import {
  isSuggestionsPremiumRequiredError,
  useGetSuggestionsQueryOptions,
} from '../queries/get-suggestions-query-options';

export function SuggestionEntry() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);

  if (!isPremium) {
    return <InfoCard label={t('feed.routineSuggestion')} onPress={() => push('/suggestions')} />;
  }

  return (
    <QueryErrorBoundary fallback={(props) => <SuggestionEntry.Error {...props} />}>
      <PremiumSuggestionEntry name={user.name} />
    </QueryErrorBoundary>
  );
}

interface PremiumSuggestionEntryProps {
  name: string;
}

function PremiumSuggestionEntry({ name }: PremiumSuggestionEntryProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['todo', 'ai']);
  const suggestionsQuery = useQuery(useGetSuggestionsQueryOptions());

  if (isSuggestionsPremiumRequiredError(suggestionsQuery.error)) {
    return (
      <InfoCard
        label={t('ai:suggestions.toasts.premiumOnly')}
        onPress={() => push('/settings/subscription')}
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
        reset={() => void suggestionsQuery.refetch()}
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
        left={<MagicIcon width={24} height={24} />}
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
