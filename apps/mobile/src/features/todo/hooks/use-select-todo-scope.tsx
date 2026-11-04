import { Box } from '@src/shared/ui';
import { type PropsWithChildren, useState } from 'react';
import { Keyboard } from 'react-native';

import { TodoScopeSelectContent } from '../components/todo-scope-select-content';
import type { TodoEditScope } from '../domains/todo-repeat.model';

interface ScopeRequest {
  action: 'edit' | 'delete';
  date: string;
  resolve: (scope: TodoEditScope | null) => void;
}

/**
 * 반복 할 일을 고치거나 지울 때 범위를 묻는다. 새 시트를 올리지 않고 쓰는 시트 안에서 내용을 갈아 끼우며,
 * 앞 화면은 그대로 두어(숨김) 입력값이 남는다. 뒤로 가면 null이다.
 */
export function useSelectTodoScope() {
  const [request, setRequest] = useState<ScopeRequest | null>(null);

  const selectScope = (action: ScopeRequest['action'], date: string) =>
    new Promise<TodoEditScope | null>((resolve) => {
      Keyboard.dismiss();
      setRequest({ action, date, resolve });
    });

  const settle = (scope: TodoEditScope | null) => {
    request?.resolve(scope);
    setRequest(null);
  };

  return {
    selectEditScope: (date: string) => selectScope('edit', date),
    selectDeleteScope: (date: string) => selectScope('delete', date),
    scopeRequest: request,
    settleScope: settle,
  };
}

type ScopeStep = Pick<ReturnType<typeof useSelectTodoScope>, 'scopeRequest' | 'settleScope'>;

interface TodoScopeStepProps extends PropsWithChildren {
  step: ScopeStep;
}

/** 범위를 묻는 동안 children을 숨기고 같은 자리에 범위 선택을 보인다 */
export function TodoScopeStep({ step, children }: TodoScopeStepProps) {
  const { scopeRequest, settleScope } = step;

  return (
    <>
      <Box className={scopeRequest == null ? undefined : 'hidden'}>{children}</Box>
      {scopeRequest != null && (
        <TodoScopeSelectContent
          action={scopeRequest.action}
          date={scopeRequest.date}
          onChange={settleScope}
          onBack={() => settleScope(null)}
        />
      )}
    </>
  );
}
