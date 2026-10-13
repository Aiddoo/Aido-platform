import { zodResolver } from '@hookform/resolvers/zod';
import {
  type UpdateNameFormInput,
  updateNameFormSchema,
} from '@src/features/user/domains/update-name-form.schema';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useUpdateProfileMutationOptions } from '@src/features/user/queries/use-update-profile-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { H3, Input, KeyboardAdaptiveButton, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Suspense } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { match, P } from 'ts-pattern';

function EditNameScreen() {
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
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
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
                errorMessage={match(error)
                  .with(P.nullish, () => undefined)
                  .with({ type: 'too_big' }, () => t('editName.maxLength'))
                  .otherwise(() => t('editName.required'))}
                onSubmitEditing={() => {
                  if (canSubmit) {
                    handleSubmit(onSubmit)();
                  }
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

export default function EditNameRoute() {
  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <EditNameScreen />
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
}
