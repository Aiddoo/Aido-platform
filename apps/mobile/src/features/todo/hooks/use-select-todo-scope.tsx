import { Box, ModalBottomSheet, useOverlay } from '@src/shared/ui';
import { type PropsWithChildren, useState } from 'react';
import { Keyboard } from 'react-native';

import { TodoScopeSelectContent } from '../components/todo-scope-select-content';
import type { TodoEditScope, TodoUpdateScope } from '../domains/todo-repeat.model';

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
    selectEditScope: async (date: string): Promise<TodoUpdateScope | null> => {
      const scope = await selectScope('edit', date);
      return scope === 'ALL' ? null : scope;
    },
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

/**
 * 키보드를 쓰는 입력 시트에서 수정 범위를 묻는다. 안에서 내용을 갈아 끼우면 화면 폭 시트가 남고 키보드가 내려가는 동안
 * 높이가 튀어서, 날짜·반복 선택처럼 떠 있는 시트를 위에 올린다. 아래 폼은 그대로라 입력값이 남는다.
 * 뒤로 가거나 바깥을 눌러 닫으면 null이고, 닫힘이 끝난 뒤 onBack을 부른다.
 */
export function useSelectTodoEditScopeInOverlay({ onBack }: { onBack: () => void }) {
  const overlay = useOverlay();

  return (
    date: string,
    { isFollowingOnly = false }: { isFollowingOnly?: boolean } = {},
  ): Promise<TodoUpdateScope | null> => {
    Keyboard.dismiss();
    let selectedScope: TodoUpdateScope | null = null;

    return overlay.open<TodoUpdateScope | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet
        isOpen={isOpen}
        onOpenChange={() => close(null)}
        onExit={() => {
          exit();
          if (selectedScope == null) {
            onBack();
          }
        }}
      >
        <TodoScopeSelectContent
          action="edit"
          date={date}
          isFollowingOnly={isFollowingOnly}
          onChange={(scope) => {
            selectedScope = scope === 'ALL' ? null : scope;
            close(selectedScope);
          }}
          onBack={() => close(null)}
        />
      </ModalBottomSheet>
    ));
  };
}
