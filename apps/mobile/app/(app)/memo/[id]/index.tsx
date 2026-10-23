import { MemoDetailPane } from '@src/features/memo/components/memo-detail-pane/memo-detail-pane';
import { memoScreenParamsSchema } from '@src/features/memo/hooks/use-memo-screen-params';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MemoDetailRoute() {
  const params = memoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return <MemoDetailPane presentation="screen" />;
}
