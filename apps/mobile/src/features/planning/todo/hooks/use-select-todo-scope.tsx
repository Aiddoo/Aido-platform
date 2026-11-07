import { TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { useState } from 'react';
import { Keyboard } from 'react-native';

import type { TodoEditScope, TodoUpdateScope } from '../schemas/todo-repeat.schema';

export interface ScopeRequest {
  action: 'edit' | 'delete';
  date: string;
  scopes: readonly TodoEditScope[];
  resolve: (scope: TodoEditScope | null) => void;
}

/**
 * 반복 할 일을 고치거나 지울 때 범위를 묻는다. 새 시트를 올리지 않고 쓰는 시트 안에서 내용을 갈아 끼우며,
 * 앞 화면은 그대로 두어(숨김) 입력값이 남는다. 뒤로 가면 null이다.
 */
export function useSelectTodoScope() {
  const [request, setRequest] = useState<ScopeRequest | null>(null);

  const selectScope = (
    action: ScopeRequest['action'],
    date: string,
    scopes: readonly TodoEditScope[],
  ) =>
    new Promise<TodoEditScope | null>((resolve) => {
      Keyboard.dismiss();
      setRequest({ action, date, scopes, resolve });
    });

  const settle = (scope: TodoEditScope | null) => {
    request?.resolve(scope);
    setRequest(null);
  };

  return {
    selectEditScope: async (date: string): Promise<TodoUpdateScope | null> => {
      const scope = await selectScope('edit', date, TODO_UPDATE_SCOPES);
      return scope === 'ALL' ? null : scope;
    },
    selectDeleteScope: (date: string, scopes: readonly TodoEditScope[]) =>
      selectScope('delete', date, scopes),
    scopeRequest: request,
    settleScope: settle,
  };
}
