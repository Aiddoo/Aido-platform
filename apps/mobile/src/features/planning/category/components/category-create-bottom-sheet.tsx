import { zodResolver } from '@hookform/resolvers/zod';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Button, KeyboardBottomSheet, useSheetRoute, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { type ComponentProps, useEffect, useEffectEvent, useState } from 'react';
import { Controller, FormState, useForm } from 'react-hook-form';

import { useCreateTodoCategoryMutationOptions } from '../queries/todo-category.mutations';
import {
  TODO_CATEGORY_FORM_DEFAULT_VALUES,
  todoCategoryFormSchema,
} from '../schemas/todo-category-form.schema';
import { CategoryColorInput } from './category-color-input';
import { CategoryNameInput, getCategoryNameErrorMessage } from './category-name-input';

type CategoryCreateBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
>;

export function CategoryCreateBottomSheet(props: CategoryCreateBottomSheetProps) {
  const { t } = useTranslation(['todo', 'common']);
  const sheet = useSheetRoute('/settings/category-settings');
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'category_create' });

  // 링크로 바로 열어도 설정의 추가 버튼처럼 이름을 쓰기 전에 막는다. 진입 때 한 번 정해 쓰는 동안 바뀐 한도로 시트를 거두지 않는다
  const [isBlockedOnEntry] = useState(() => gate.isBlocked());
  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    defaultValues: TODO_CATEGORY_FORM_DEFAULT_VALUES,
    mode: 'onChange',
  });

  const createCategory = useMutation(useCreateTodoCategoryMutationOptions());

  // 이름 시트 없이 안내만 띄우고 안내가 끝나면 떠난다. 그사이 한도가 풀렸어도 빈 route가 화면을 막지 않게 떠난다
  const promptLimitOnEntry = useEffectEvent(() => {
    if (!gate.promptIfBlocked({ onFinish: sheet.exit })) {
      sheet.exit();
    }
  });
  useEffect(() => {
    if (isBlockedOnEntry) {
      promptLimitOnEntry();
    }
  }, [isBlockedOnEntry]);

  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const submitCategory = form.handleSubmit(async (values) => {
    await createCategory.mutateAsync(values, {
      onSuccess: () => sheet.close(),
      // 시트 route 안의 Overlay에 띄워 시트 위에 보인다. 구독하러 가면 시트를 바로 떠난다
      onError: (error) => gate.promptIfBlockedError(error, { onSubscribe: sheet.exit }),
    });
  });
  // 훅이라 조기 반환보다 앞에 둔다. 완료 키는 버튼이 꺼져도 들어와 여기서도 막는다
  const handleSavePress = useSingleTap((isSubmitLocked: boolean) => {
    if (isSubmitLocked) {
      return;
    }
    submitCategory().catch(noop);
  });

  if (isBlockedOnEntry) {
    return null;
  }

  return (
    <KeyboardBottomSheet
      {...props}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={
        <FormState
          control={form.control}
          // 추가하면 시트가 내려가는 동안에도 같은 이름이 남아 있다. 그동안 다시 보내지 않는다
          render={({ isSubmitting, isSubmitSuccessful }) => (
            <Button
              size="large"
              onPress={() => handleSavePress(isSubmitting || isSubmitSuccessful)}
              isLoading={isSubmitting || isSubmitSuccessful}
            >
              {t('common:actions.confirm')}
            </Button>
          )}
        />
      }
    >
      <VStack gap={20}>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState, formState: { isSubmitting, isSubmitSuccessful } }) => (
            <CategoryNameInput
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              isInvalid={fieldState.error != null}
              errorMessage={getCategoryNameErrorMessage(fieldState.error)}
              onSubmitEditing={() => handleSavePress(isSubmitting || isSubmitSuccessful)}
            />
          )}
        />

        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <CategoryColorInput value={field.value} onValueChange={field.onChange} />
          )}
        />
      </VStack>
    </KeyboardBottomSheet>
  );
}
