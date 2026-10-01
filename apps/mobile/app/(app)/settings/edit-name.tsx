import { zodResolver } from '@hookform/resolvers/zod';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useUpdateProfileMutationOptions } from '@src/features/user/presentations/queries/use-update-profile-mutation-options';
import {
  type UpdateNameFormInput,
  updateNameFormSchema,
} from '@src/features/user/presentations/schemas/update-name-form.schema';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { H3, Input, KeyboardAdaptiveButton, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

const EditNameScreen = () => {
  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <EditNameForm />
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
};

export default EditNameScreen;

function EditNameForm() {
  const { showBoundary } = useErrorBoundary();

  const goBack = useSingleTap(router.back);

  const { t } = useTranslation('user');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());

  const formMethods = useForm({
    resolver: zodResolver(updateNameFormSchema),
    defaultValues: { name: user.name },
    mode: 'onChange',
  });
  const { control, handleSubmit } = formMethods;
  const { isSubmitting, isValid, isDirty } = useFormState({ control });

  const canSubmit = isValid && isDirty;

  const onSubmit = async (data: UpdateNameFormInput) => {
    try {
      await updateProfileMutation.mutateAsync({ name: data.name }, { onSuccess: () => goBack() });
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <H3>{t('editName.header')}</H3>

          <Spacing size={24} />

          <FormField control={control} name="name">
            {({ onChange, value }, { error }) => (
              <Input
                label={t('editName.label')}
                placeholder={t('editName.placeholder')}
                value={value}
                onChange={onChange}
                autoFocus
                autoCapitalize="none"
                submitBehavior="submit"
                returnKeyType="done"
                isInvalid={!!error}
                errorMessage={
                  error == null
                    ? undefined
                    : error.type === 'too_big'
                      ? t('editName.maxLength')
                      : t('editName.required')
                }
                onSubmitEditing={() => {
                  if (canSubmit) handleSubmit(onSubmit)();
                }}
              />
            )}
          </FormField>
        </ScrollView>

        <KeyboardAdaptiveButton
          onPress={() => handleSubmit(onSubmit)()}
          isDisabled={!canSubmit}
          isLoading={isSubmitting}
        >
          {t('editName.submit')}
        </KeyboardAdaptiveButton>
      </View>
    </FormProvider>
  );
}
