import type { CreateRecurringTodoInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useActivationService, useTodoService } from '@src/bootstrap/providers/di-context';
import { recordTodoCreatedForActivation } from '@src/features/activation/queries/activation-cache';
import { getCachedMe } from '@src/features/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { invalidateTodos } from './todo-cache';

export interface CreateRecurringTodoParams {
  input: CreateRecurringTodoInput;
  source: 'manual' | 'ai';
}

export const useCreateRecurringTodoMutationOptions = () => {
  const todoService = useTodoService();
  const activationService = useActivationService();
  const { trackEvent, trackAttributedFeatureSuccess } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ input }: CreateRecurringTodoParams) => {
      const result = await todoService.createRecurringTodo(input);
      return unwrap(result);
    },
    onSuccess: (_data, { input, source }) => {
      recordTodoCreatedForActivation({ queryClient, service: activationService });
      invalidateTodos(queryClient);
      toast.success(t('todo:toast.recurringAdded'));
      trackEvent('todo_created', {
        source,
        creation_entry: source === 'ai' ? 'ai_parse' : 'recurring',
        is_recurring: true,
        has_scheduled_time: !!input.scheduledTime,
        is_all_day: input.isAllDay,
        visibility: input.visibility ?? 'PUBLIC',
      });
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId) {
        trackAttributedFeatureSuccess({ accountId, feature: 'todo_creation' });
      }
    },
    onError: (error) => {
      notifyError();

      if (isApiError(error) && error.hasCode(ErrorCode.TODO_0813)) {
        toast.error(t('todo:toast.recurringCategoryLimit'));
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('todo:toast.addFailedRetry') });
    },
  });
};
