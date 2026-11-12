import { zodResolver } from '@hookform/resolvers/zod';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, KeyboardBottomSheet, useSheetRoute } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import type { ComponentProps } from 'react';
import { useForm, useFormState } from 'react-hook-form';

import { useCreateTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import {
  TODO_CATEGORY_FORM_DEFAULT_VALUES,
  todoCategoryFormSchema,
} from '../schemas/todo-category-form.schema';
import { CategoryFormFields } from './category-form-fields';

type CategoryCreateBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function CategoryCreateBottomSheet(props: CategoryCreateBottomSheetProps) {
  const sheet = useSheetRoute('/settings/category-settings');
  const { t } = useTranslation(['todo', 'common']);
  const createCategory = useMutation(useCreateTodoCategoryMutationOptions());
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'category_create' });

  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    defaultValues: TODO_CATEGORY_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });
  const { isSubmitting } = useFormState({ control: form.control });

  const submitCategory = form.handleSubmit(async (values) => {
    await createCategory
      .mutateAsync(values, {
        onSuccess: () => sheet.close(),
        // 시트 route 안의 Overlay에 띄워 시트 위에 보인다. 구독하러 가면 시트를 바로 떠난다
        onError: (error) => gate.promptIfBlockedError(error, { onSubscribe: sheet.exit }),
      })
      .catch(noop);
  });
  const handleSubmit = useSingleTap(() => submitCategory());

  return (
    <KeyboardBottomSheet
      {...props}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={
        <Button size="large" onPress={handleSubmit} isLoading={isSubmitting}>
          {t('common:actions.confirm')}
        </Button>
      }
    >
      <CategoryFormFields control={form.control} onSubmit={handleSubmit} />
    </KeyboardBottomSheet>
  );
}
