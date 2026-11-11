import { Box } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';

import type { TodoEditScope } from '../domains/todo-repeat.model';
import type { ScopeRequest } from '../hooks/use-select-todo-scope';
import { TodoScopeSelectContent } from './todo-scope-select-content';

interface TodoScopeStepProps extends PropsWithChildren {
  step: {
    scopeRequest: ScopeRequest | null;
    settleScope: (scope: TodoEditScope | null) => void;
  };
}

export function TodoScopeStep({ step, children }: TodoScopeStepProps) {
  const { scopeRequest, settleScope } = step;

  return (
    <>
      {/* oxlint-disable-next-line aido/no-classname-concat -- 1.15.2 전환 #1400 */}
      <Box className={scopeRequest == null ? undefined : 'hidden'}>{children}</Box>
      {scopeRequest != null && (
        <TodoScopeSelectContent
          action={scopeRequest.action}
          date={scopeRequest.date}
          scopes={scopeRequest.scopes}
          onChange={settleScope}
          onBack={() => settleScope(null)}
        />
      )}
    </>
  );
}
