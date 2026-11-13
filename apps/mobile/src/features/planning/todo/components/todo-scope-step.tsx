import { Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { PropsWithChildren } from 'react';

import type { TodoEditScope } from '../domains/todo-repeat.model';
import type { ScopeRequest } from '../hooks/use-select-todo-scope';
import { TodoScopeSelect } from './todo-scope-select';

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
      <Box className={cn(scopeRequest != null && 'hidden')}>{children}</Box>
      {scopeRequest != null && (
        <TodoScopeSelect
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
