import { todoScreenParamsSchema } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { NudgeThanksBottomSheet } from '@src/features/social/nudge/components/nudge-interactions/nudge-thanks-bottom-sheet';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoThanksSheetRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <NudgeThanksBottomSheet />
    </SheetRouteScreen>
  );
}
