import { userTagParamSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/friend/presentations/queries/use-send-request-by-tag-mutation-options';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { H3, Input, KeyboardAdaptiveButton, Spacing, Text } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import type { z } from 'zod';

type FormData = z.infer<typeof userTagParamSchema>;

const AddFriendScreen = () => {
  const goBack = useSingleTap(router.back);

  const { t } = useTranslation('friend');
  const sendRequestMutation = useMutation(useSendRequestByTagMutationOptions());

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(userTagParamSchema),
    defaultValues: { userTag: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: FormData) => {
    sendRequestMutation.mutate(data.userTag, {
      onSuccess: () => goBack(),
    });
  };

  return (
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

        <Controller
          control={control}
          name="userTag"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t('add.tagLabel')}
              placeholder="ABC12345"
              value={value}
              onChangeText={onChange}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={!!errors.userTag}
              errorMessage={resolveValidationMessage(errors.userTag, {
                default: 'userTag.pattern',
                byType: { too_small: 'userTag.length', too_big: 'userTag.length' },
              })}
              onSubmitEditing={() => {
                if (isValid) handleSubmit(onSubmit)();
              }}
            />
          )}
        />
      </ScrollView>

      <KeyboardAdaptiveButton
        onPress={handleSubmit(onSubmit)}
        isDisabled={!isValid}
        isLoading={sendRequestMutation.isPending}
      >
        {t('add.submit')}
      </KeyboardAdaptiveButton>
    </View>
  );
};

export default AddFriendScreen;
