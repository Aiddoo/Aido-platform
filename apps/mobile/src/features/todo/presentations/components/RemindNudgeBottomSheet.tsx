import aidoBannerImage from '@assets/images/aido_banner.webp';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FriendUserViewModel } from '@src/features/friend/presentations/view-models/friend-user.view-model';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { BottomSheetTextArea, Button, H4, KeyboardBottomSheet, Text, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { Image, View } from 'react-native';

import { useSendRemindNudgeMutationOptions } from '../queries/use-send-remind-nudge-mutation-options';
import { type NudgeFormInput, nudgeFormSchema } from '../schemas/nudge-form.schema';

interface RemindNudgeBottomSheetProps {
  friend: FriendUserViewModel;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function RemindNudgeBottomSheet({
  friend,
  isOpen,
  onOpenChange,
}: RemindNudgeBottomSheetProps) {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation('todo');
  const sendRemindNudgeMutation = useMutation(useSendRemindNudgeMutationOptions());

  const formMethods = useForm({
    resolver: zodResolver(nudgeFormSchema),
    defaultValues: { message: '' },
    mode: 'onChange',
  });
  const { control, handleSubmit, reset } = formMethods;
  const { isSubmitting, isValid } = useFormState({ control: control });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const onSubmit = async (data: NudgeFormInput) => {
    try {
      await sendRemindNudgeMutation.mutateAsync(
        {
          receiverId: friend.id,
          message: data.message,
        },
        {
          onSuccess: () => handleOpenChange(false),
        },
      );
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <KeyboardBottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
        <VStack gap={16} pb={16}>
          <VStack gap={4}>
            <VStack gap={2}>
              <Text size="b3" shade={6}>
                {t('nudge.remindTitle')}
              </Text>
              <H4>{t('nudge.sheetTitle')}</H4>
            </VStack>
          </VStack>

          <View>
            <Image
              source={aidoBannerImage}
              className="absolute right-4 size-[72px] -translate-y-11"
              resizeMode="contain"
            />
            <FormField control={control} name="message">
              {({ onChange, value }, { error }) => (
                <BottomSheetTextArea
                  label={`to. ${friend.displayName}`}
                  isInvalid={!!error}
                  placeholder={t('nudge.remindPlaceholder')}
                  value={value ?? ''}
                  onChange={onChange}
                  className="z-10 min-h-0 h-[80px]"
                  errorMessage={error?.message}
                />
              )}
            </FormField>
          </View>

          <Button
            color="primary"
            size="large"
            display="block"
            onPress={() => handleSubmit(onSubmit)()}
            isDisabled={!isValid}
            isLoading={isSubmitting}
          >
            {t('nudge.send')}
          </Button>
        </VStack>
      </KeyboardBottomSheet>
    </FormProvider>
  );
}
