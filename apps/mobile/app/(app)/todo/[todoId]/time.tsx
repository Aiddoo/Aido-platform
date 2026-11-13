import { useAskPushPermissionOnTodoTime } from '@src/features/notification/hooks/use-ask-push-permission-on-todo-time';
import { TodoTimeBottomSheet } from '@src/features/planning/todo/components/todo-list/todo-time-bottom-sheet';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { SheetRouteScreen } from '@src/shared/ui';

export default function TodoTimeSheetRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });
  const askPushPermission = useAskPushPermissionOnTodoTime();

  if (route.redirect != null) {
    return route.redirect;
  }

  return (
    <SheetRouteScreen>
      <TodoTimeBottomSheet onTimeScheduled={askPushPermission} />
    </SheetRouteScreen>
  );
}
