import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateProfileMutationOptions } from '@src/features/identity/user/queries/user.mutations';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { updateNameFormSchema } from '@src/features/identity/user/schemas/update-name-form.schema';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FormStepLayout,
  Input,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  ReadableContent,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { Suspense } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { match, P } from 'ts-pattern';

function EditNameScreen() {
  const { t } = useTranslation('user');
  const navigation = useNavigation();
  const reportUnexpectedError = useReportUnexpectedError('user');
  const goBack = useSingleTap(router.back);
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfile = useMutation(useUpdateProfileMutationOptions());

  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: { name: user.name },
    mode: 'onChange',
  });
  const { isSubmitting, isValid, isDirty } = useFormState({ control: form.control });
  const canSubmit = isValid && isDirty;

  // 실패하면 토스트는 mutation이 한 번 알리고 화면과 입력값은 그대로 둔다
  const submitName = form.handleSubmit(async ({ name }) => {
    try {
      await updateProfile.mutateAsync({ name });
      // 저장하는 동안 이미 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
      if (navigation.isFocused()) {
        goBack();
      }
    } catch (error) {
      reportUnexpectedError(error);
    }
  });
  const handleSubmit = useSingleTap(() => submitName());

  return (
    <Box className="flex-1">
      <FormStepLayout title={t('editName.header')}>
        <Controller
          control={form.control}
          name="name"
          render={({ field: { value, onChange, ref }, fieldState: { error } }) => (
            <Input
              ref={ref}
              testID="edit-name-input"
              label={t('editName.label')}
              placeholder={t('editName.placeholder')}
              value={value}
              onChange={onChange}
              autoFocus
              autoCapitalize="none"
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={error != null}
              errorMessage={match(error)
                .with(P.nullish, () => undefined)
                .with({ type: 'too_big' }, () => t('editName.maxLength'))
                .otherwise(() => t('editName.required'))}
              onSubmitEditing={() => {
                if (canSubmit) {
                  handleSubmit();
                }
              }}
            />
          )}
        />
      </FormStepLayout>
      <KeyboardAdaptiveButton
        testID="edit-name-submit"
        onPress={handleSubmit}
        isDisabled={!canSubmit}
        isLoading={isSubmitting}
      >
        {t('editName.submit')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}

export default function EditNameRoute() {
  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary>
          {/* 내 정보는 마이페이지에서 이미 불러와 캐시에서 바로 읽혀 따로 보여 줄 로딩이 없다 */}
          <Suspense fallback={<Box className="flex-1" />}>
            <EditNameScreen />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </Box>
  );
}
