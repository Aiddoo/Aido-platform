import { Box } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';

import type { ScopeRequest } from '../hooks/use-select-todo-scope';
import type { TodoEditScope } from '../schemas/todo-repeat.schema';
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
