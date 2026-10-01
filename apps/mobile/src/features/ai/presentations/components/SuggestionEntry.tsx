import MagicIcon from '@assets/icons/ic_magic.svg';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ListRow } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';

import { useGetSuggestionsQueryOptions } from '../queries/get-suggestions-query-options';

export function SuggestionEntry() {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);

  if (!isPremium) {
    return <InfoCard label={t('feed.routineSuggestion')} onPress={() => push('/suggestions')} />;
  }

  return (
    <Suspense fallback={<InfoCard label={t('feed.suggestionsLoading')} />}>
      <PremiumSuggestionEntry name={user.name} />
    </Suspense>
  );
}

interface PremiumSuggestionEntryProps {
  name: string;
}

function PremiumSuggestionEntry({ name }: PremiumSuggestionEntryProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('todo');
  const { data: suggestions } = useSuspenseQuery(useGetSuggestionsQueryOptions());

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
