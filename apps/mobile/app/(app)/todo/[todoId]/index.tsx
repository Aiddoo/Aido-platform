import { TodoCommentPane } from '@src/features/engagement/comment/components/todo-comment-pane';
import { TodoCommentTitleBar } from '@src/features/engagement/comment/components/todo-comment-title-bar';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { StyledSafeAreaView } from '@src/shared/ui';

export default function TodoDetailRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <TodoDetailScreen />;
}

function TodoDetailScreen() {
  const goBack = useGoBack({ fallbackHref: '/feed' });

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']} testID="todo-detail">
      <TodoCommentPane titleBar={<TodoCommentTitleBar.StackHeader />} onClose={goBack} />
    </StyledSafeAreaView>
  );
}
