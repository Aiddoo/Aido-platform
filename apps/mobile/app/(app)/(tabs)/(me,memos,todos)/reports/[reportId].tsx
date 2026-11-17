import { SuggestionsPreview } from '@src/features/assistant/suggestion/components/suggestions-preview';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { reportParamsSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { QueryErrorBoundary, ReadableContent, SafeAreaScrollView, Spacing } from '@src/shared/ui';
import { Suspense } from 'react';

export default function ReportDetailRoute() {
  const route = useRouteParamsOrRedirect(reportParamsSchema, { fallbackHref: '/reports' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <ReportDetailScreen />;
}

function ReportDetailScreen() {
  const [{ reportId }] = useRouteParams(reportParamsSchema);

  return (
    <SafeAreaScrollView className="flex-1 bg-white" contentContainerClassName="grow">
      <ReadableContent className="grow px-4 pb-8">
        <Spacing size={16} />

        <QueryErrorBoundary resetKeys={[reportId]} fallback={ActivityReport.Error}>
          <Suspense fallback={<ActivityReport.Loading />}>
            <ActivityReport />
          </Suspense>
        </QueryErrorBoundary>

        <QueryErrorBoundary fallback={SuggestionsPreview.Error}>
          <Suspense fallback={<SuggestionsPreview.Loading className="mt-3" />}>
            <SuggestionsPreview className="mt-3" />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </SafeAreaScrollView>
  );
}
