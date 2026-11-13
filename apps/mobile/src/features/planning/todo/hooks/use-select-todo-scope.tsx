import { TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import type { DateKey } from '@src/shared/date/date-key';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import type { TodoEditScope } from '../domains/todo-repeat.model';

export interface ScopeRequest {
  action: 'edit' | 'delete';
  date: DateKey;
  scopes: readonly TodoEditScope[];
  resolve: (scope: TodoEditScope | null) => void;
}

/** 새 시트 없이 쓰는 시트 안에서 내용을 갈아 끼워 앞 화면의 입력값이 남는다. 뒤로 가면 null이다 */
export function useSelectTodoScope() {
  const [request, setRequest] = useState<ScopeRequest | null>(null);
  const requestRef = useRef(request);

  useLayoutEffect(() => {
    requestRef.current = request;
  });

  // 범위를 묻는 중에 시트가 밖에서 닫히면 대기 중인 저장 핸들러가 영원히 남지 않게 취소로 끝낸다
  useEffect(
    () => () => {
      requestRef.current?.resolve(null);
    },
    [],
  );

  // 고른 값을 보인 범위에서 다시 찾아 부른 쪽이 넘긴 범위 타입으로 돌려준다
  const selectScope = <TScope extends TodoEditScope>(
    action: ScopeRequest['action'],
    date: DateKey,
    scopes: readonly TScope[],
  ) =>
    new Promise<TScope | null>((resolve) => {
      Keyboard.dismiss();
      setRequest({
        action,
        date,
        scopes,
        resolve: (scope) => resolve(scopes.find((shown) => shown === scope) ?? null),
      });
    });

  const settle = (scope: TodoEditScope | null) => {
    request?.resolve(scope);
    setRequest(null);
  };

  return {
    selectEditScope: (date: DateKey) => selectScope('edit', date, TODO_UPDATE_SCOPES),
    selectDeleteScope: (date: DateKey, scopes: readonly TodoEditScope[]) =>
      selectScope('delete', date, scopes),
    scopeRequest: request,
    settleScope: settle,
  };
}
