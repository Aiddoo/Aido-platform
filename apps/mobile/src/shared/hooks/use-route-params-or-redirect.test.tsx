import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { z } from 'zod';

import { routeIdSchema } from '../schemas/route-params.schema';
import { useRouteParamsOrRedirect } from './use-route-params-or-redirect';

jest.unmock('expo-router');

const todoParamsSchema = z.object({ todoId: routeIdSchema });

function TodoGuardRoute() {
  const route = useRouteParamsOrRedirect(todoParamsSchema, { fallbackHref: '/feed' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <Text testID="todo">{route.params.todoId}</Text>;
}

async function openTodoRoute(initialUrl: string) {
  return renderRouter(
    {
      'todo/[todoId]': TodoGuardRoute,
      feed: () => <Text testID="feed">feed</Text>,
    },
    { initialUrl },
  );
}

describe('useRouteParamsOrRedirect', () => {
  it.each(['/todo/abc', '/todo/0', '/todo/012'])(
    '검증에 실패한 주소(%s)는 fallbackHref로 바꾸고 안쪽 화면을 그리지 않는다',
    async (url) => {
      // When
      const route = await openTodoRoute(url);

      // Then
      expect(route.getPathname()).toBe('/feed');
      expect(screen.queryByTestId('todo')).toBeNull();
    },
  );

  it('검증을 지나면 좁혀진 값으로 그린다', async () => {
    // When
    const route = await openTodoRoute('/todo/12');

    // Then
    expect(route.getPathname()).toBe('/todo/12');
    expect(screen.getByTestId('todo')).toHaveTextContent('12');
  });
});
