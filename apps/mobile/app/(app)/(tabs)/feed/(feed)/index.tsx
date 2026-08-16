import MagicIcon from '@assets/icons/ic_magic.svg';
import { ActivationChecklist } from '@src/features/activation/presentations/components/ActivationChecklist';
import { useActivationChecklist } from '@src/features/activation/presentations/hooks/use-activation-progress';
import { useGetSuggestionsQueryOptions } from '@src/features/ai/presentations/queries/use-get-suggestions-query-options';
import { FeatureDiscoveryReentryCard } from '@src/features/feature-discovery/presentations/components/FeatureDiscoveryReentryCard';
import { useFeatureDiscoveryFeed } from '@src/features/feature-discovery/presentations/hooks/use-feature-discovery-feed';
import { MarketingPushOptInBanner } from '@src/features/notification/presentations/components/MarketingPushOptInBanner';
import { MyCalendar } from '@src/features/todo/presentations/components/Calendar/MyCalendar';
import { TodoList } from '@src/features/todo/presentations/components/TodoList/TodoList';
import { TODO_QUERY_KEYS } from '@src/features/todo/presentations/constants/todo-query-keys.constant';
import { useFeedDateKey } from '@src/features/todo/presentations/hooks/use-feed-date';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { WEATHER_QUERY_KEYS } from '@src/features/weather/presentations/constants/weather-query-keys.constant';
import { useRefresh } from '@src/shared/hooks/useRefresh';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTabBarHeight } from '@src/shared/hooks/useTabBarHeight';
import { useTranslation } from '@src/shared/i18n';
import { Box, ListRow, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';
import { RefreshControl } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

export default function MyFeedScreen() {
  const { t } = useTranslation('todo');
  const selectedDateKey = useFeedDateKey();
  const tabBarHeight = useTabBarHeight();
  const queryClient = useQueryClient();
  const featureDiscovery = useFeatureDiscoveryFeed();
  const activation = useActivationChecklist();
  const [refreshing, onRefresh] = useRefresh(() =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
      queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
      queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all }),
    ]),
  );

  return (
    <NestableScrollContainer
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarHeight }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <MyCalendar />

      <Spacing size={10} />

      {activation.isVisible && (
        <>
          <Box px={16}>
            <ActivationChecklist progress={activation.progress} />
          </Box>
          <Spacing size={20} />
        </>
      )}

      <QueryErrorBoundary
        resetKeys={[selectedDateKey]}
        fallback={(props) => <TodoList.Error {...props} />}
      >
        <Suspense fallback={<TodoList.Loading />}>
          <TodoList key={selectedDateKey} />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={20} />

      {featureDiscovery.isReentryVisible && (
        <>
          <Box px={16}>
            <FeatureDiscoveryReentryCard onPress={featureDiscovery.openFromReentry} />
          </Box>
          <Spacing size={20} />
        </>
      )}

      <QueryErrorBoundary fallback={() => null}>
        <Suspense fallback={null}>
          <MarketingPushOptInBanner />
        </Suspense>
      </QueryErrorBoundary>

      <Box px={16}>
        <QueryErrorBoundary>
          <Suspense fallback={<InfoCard label={t('feed.loading')} />}>
            <SuggestionEntry />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
      <Spacing size={20} />
    </NestableScrollContainer>
  );
}

function SuggestionEntry() {
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
