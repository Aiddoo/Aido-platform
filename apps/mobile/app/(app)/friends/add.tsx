import { userTagParamSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/friend/queries/use-send-request-by-tag-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  Input,
  KeyboardAdaptiveButton,
  Spacing,
  Text,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Box,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import { ScrollView } from 'react-native';
import type { z } from 'zod';

type FormData = z.infer<typeof userTagParamSchema>;

function AddFriendScreen() {
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

  const handleSubmitFriendRequest = async (values: FormData) => {
    try {
      await sendRequestMutation.mutateAsync(values.userTag, {
        onSuccess: () => goBack(),
      });
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <Box className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <StyledSafeAreaView edges={['left', 'right']}>
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
                    if (isValid) {
                      handleSubmit(handleSubmitFriendRequest)();
                    }
                  }}
                />
              )}
            </FormField>
          </StyledSafeAreaView>
        </ScrollView>

        <KeyboardAdaptiveButton
          onPress={() => handleSubmit(handleSubmitFriendRequest)()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
        >
          {t('add.submit')}
        </KeyboardAdaptiveButton>
      </Box>
    </FormProvider>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function AddFriendRoute() {
  return (
    <QueryErrorBoundary>
      <AddFriendScreen />
    </QueryErrorBoundary>
  );
}
