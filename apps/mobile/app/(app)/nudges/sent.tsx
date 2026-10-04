import { SentNudgeList } from '@src/features/todo/presentations/components/nudge-interactions/SentNudgeList';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ScreenTitleBar, StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense } from 'react';

export default function SentNudgesScreen() {
  const { t } = useTranslation('todo');
  const goBack = useSingleTap(() =>
    router.canGoBack() ? router.back() : router.replace('/notifications'),
  );

  return (
    <StyledSafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScreenTitleBar title={t('interaction.sent')} onBackPress={goBack} />
      <QueryErrorBoundary fallback={SentNudgeList.Error}>
        <Suspense fallback={<SentNudgeList.Loading />}>
          <SentNudgeList />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
