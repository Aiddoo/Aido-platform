import { NudgeModerationToolbar } from '@src/features/social/nudge/components/nudge-moderation-toolbar';
import { NudgeResponse } from '@src/features/social/nudge/components/nudge-response';
import { NudgeSummary } from '@src/features/social/nudge/components/nudge-summary';
import { NudgeTodoButton } from '@src/features/social/nudge/components/nudge-todo-button';
import { isNudgeUnavailableError } from '@src/features/social/nudge/domains/todo-nudge.error';
import { useNudgeId } from '@src/features/social/nudge/hooks/use-nudge-id';
import { nudgeParamsSchema } from '@src/features/social/nudge/schemas/nudge-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useTranslation } from '@src/shared/i18n';
import { dismissToTab } from '@src/shared/navigation/open-entry-href';
import {
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Result,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function NudgeDetailRoute() {
  const route = useRouteParamsOrRedirect(nudgeParamsSchema, { fallbackHref: '/notifications' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <NudgeDetailScreen />;
}

function NudgeDetailScreen() {
  const [nudgeId] = useNudgeId();

  return (
    <StyledSafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary resetKeys={[nudgeId]} fallback={NudgeDetailScreen.Error}>
          <Suspense fallback={<NudgeDetailScreen.Loading />}>
            <NudgeModerationToolbar />

            <ScrollView contentContainerClassName="grow">
              <StyledSafeAreaView edges={['left', 'right']} className="p-6" testID="nudge-detail">
                <NudgeSummary />

                <Spacing size={24} />

                <NudgeTodoButton />

                <Spacing size={24} />

                <NudgeResponse />
              </StyledSafeAreaView>
            </ScrollView>
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

/** 응답 자리는 받은 사람인지, 완료됐는지에 따라 모양이 달라 그리지 않는다 */
NudgeDetailScreen.Loading = function Loading() {
  return (
    <ScrollView contentContainerClassName="grow">
      <StyledSafeAreaView edges={['left', 'right']} className="p-6">
        <NudgeSummary.Loading />

        <Spacing size={24} />

        <NudgeTodoButton.Loading />
      </StyledSafeAreaView>
    </ScrollView>
  );
};

NudgeDetailScreen.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['todo', 'common']);

  if (isNudgeUnavailableError(error)) {
    return (
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
        <Result
          title={t('todo:interaction.unavailable')}
          description={t('todo:interaction.unavailableDescription')}
          button={
            <Result.Button onPress={() => dismissToTab('/notifications')}>
              {t('common:actions.goBack')}
            </Result.Button>
          }
        />
      </StyledSafeAreaView>
    );
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
      <Result
        title={t('todo:interaction.loadError')}
        button={<Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>}
      />
    </StyledSafeAreaView>
  );
};
