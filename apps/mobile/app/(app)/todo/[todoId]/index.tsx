import { TodoCommentPane } from '@src/features/engagement/comment/components/todo-comment-pane';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { StyledSafeAreaView } from '@src/shared/ui';
import { router } from 'expo-router';

export default function TodoDetailRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <TodoDetailScreen />;
}

function TodoDetailScreen() {
  const goBack = useSingleTap(router.back);

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
      <TodoCommentPane titleBar={<TodoCommentTitleBar.StackHeader />} onClose={goBack} />
    </StyledSafeAreaView>
  );
}
