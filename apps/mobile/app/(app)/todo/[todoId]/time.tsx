import { usePromptPushPermission } from '@src/features/notification/hooks/use-prompt-push-permission';
import { TodoTimeBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-time-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { SheetRouteScreen } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoTimeSheetRoute() {
  const params = todoParamsSchema.safeParse(useLocalSearchParams());
  const promptPushPermission = usePromptPushPermission();

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <SheetRouteScreen>
      <TodoTimeBottomSheet onTimeScheduled={promptPushPermission} />
    </SheetRouteScreen>
  );
}
