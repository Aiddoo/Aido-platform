import { NudgeDetail } from '@src/features/social/nudge/components/nudge-detail/nudge-detail';
import { NudgeModerationToolbar } from '@src/features/social/nudge/components/nudge-detail/nudge-moderation-toolbar';
import { NudgeResponse } from '@src/features/social/nudge/components/nudge-detail/nudge-response';
import { NudgeSummary } from '@src/features/social/nudge/components/nudge-detail/nudge-summary';
import { NudgeTodoButton } from '@src/features/social/nudge/components/nudge-detail/nudge-todo-button';
import { nudgeParamsSchema } from '@src/features/social/nudge/schemas/nudge-params.schema';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  ReadableContent,
  Result,
  Spacing,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function NudgeDetailRoute() {
  const params = nudgeParamsSchema.safeParse(useLocalSearchParams());
  const { t } = useTranslation('todo');

  return (
    <StyledSafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ReadableContent flex={1}>
        {params.success ? (
          <QueryErrorBoundary resetKeys={[params.data.nudgeId]} fallback={NudgeDetail.Error}>
            <Suspense fallback={<NudgeDetail.Loading />}>
              <NudgeModerationToolbar nudgeId={params.data.nudgeId} />

              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <StyledSafeAreaView edges={['left', 'right']} className="p-6" testID="nudge-detail">
                  <NudgeSummary nudgeId={params.data.nudgeId} />

                  <Spacing size={24} />

                  <NudgeTodoButton nudgeId={params.data.nudgeId} />

                  <Spacing size={24} />

                  <NudgeResponse nudgeId={params.data.nudgeId} />
                </StyledSafeAreaView>
              </ScrollView>
            </Suspense>
          </QueryErrorBoundary>
        ) : (
          <StyledSafeAreaView edges={['left', 'right']} className="flex-1 p-6">
            <Result title={t('interaction.unavailable')} />
          </StyledSafeAreaView>
        )}
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
