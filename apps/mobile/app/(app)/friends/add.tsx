import { userTagParamSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/friend/presentations/queries/use-send-request-by-tag-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { H3, Input, KeyboardAdaptiveButton, Spacing, Text } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import type { z } from 'zod';

type FormData = z.infer<typeof userTagParamSchema>;

const AddFriendScreen = () => {
  const { showBoundary } = useErrorBoundary();

  const goBack = useSingleTap(router.back);

  const { t } = useTranslation('friend');
  const sendRequestMutation = useMutation(useSendRequestByTagMutationOptions());

  const formMethods = useForm({
    resolver: zodResolver(userTagParamSchema),
    defaultValues: { userTag: '' },
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const onSubmit = async (data: FormData) => {
    try {
      await sendRequestMutation.mutateAsync(data.userTag, {
        onSuccess: () => goBack(),
      });
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <View className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <H3>{t('add.title')}</H3>

          <Spacing size={4} />

          <Text size="b4" shade={6}>
            {t('add.description')}
          </Text>

          <Spacing size={24} />

          <FormField control={control} name="userTag">
            {({ onChange, value }, { error }) => (
              <Input
                label={t('add.tagLabel')}
                placeholder="ABC12345"
                value={value}
                onChange={onChange}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                submitBehavior="submit"
                returnKeyType="done"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'userTag.pattern',
                  byType: { too_small: 'userTag.length', too_big: 'userTag.length' },
                })}
                onSubmitEditing={() => {
                  if (isValid) handleSubmit(onSubmit)();
                }}
              />
            )}
          </FormField>
        </ScrollView>

        <KeyboardAdaptiveButton
          onPress={() => handleSubmit(onSubmit)()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
        >
          {t('add.submit')}
        </KeyboardAdaptiveButton>
      </View>
    </FormProvider>
  );
};

export default AddFriendScreen;
