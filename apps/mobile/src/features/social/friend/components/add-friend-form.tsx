import { zodResolver } from '@hookform/resolvers/zod';
import { ASCII_CODE_TEXT_INPUT_PROPS } from '@src/shared/constants/text-input-props';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { FormScrollView, Input, KeyboardAdaptiveButton, StyledSafeAreaView } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';

import { useSendRequestByTagMutationOptions } from '../queries/friend.mutations';
import {
  addFriendFormSchema,
  EMPTY_ADD_FRIEND_FORM_VALUES,
  USER_TAG_MAX_LENGTH,
} from '../schemas/add-friend-form.schema';

interface AddFriendFormProps extends PropsWithChildren {
  /** 친구 한도 안내에서 초대로 자리를 늘리는 길. 초대를 아는 화면이 넘긴다 */
  onFriendLimitInvite?: () => void;
}

/** 태그 입력과 키보드 위 요청 버튼. 입력 위에 놓는 제목과 안내는 화면이 children으로 넘긴다 */
export function AddFriendForm({ children, onFriendLimitInvite }: AddFriendFormProps) {
  const goBack = useSingleTap(router.back);
  const { t } = useTranslation('friend');
  const sendRequest = useMutation(useSendRequestByTagMutationOptions({ onFriendLimitInvite }));

  const form = useForm({
    resolver: zodResolver(addFriendFormSchema),
    defaultValues: EMPTY_ADD_FRIEND_FORM_VALUES,
    mode: 'onChange',
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });

  const submit = form.handleSubmit(async ({ userTag }) => {
    try {
      await sendRequest.mutateAsync(userTag);
      goBack();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  });

  return (
    <FormScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
      keyboardShouldPersistTaps="always"
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      footer={
        <KeyboardAdaptiveButton
          onPress={() => submit()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
          testID="friend-tag-submit"
        >
          {t('add.submit')}
        </KeyboardAdaptiveButton>
      }
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        {children}

        <Controller
          control={form.control}
          name="userTag"
          render={({ field: { onChange, value, ref }, fieldState: { error } }) => (
            <Input
              ref={ref}
              testID="friend-tag-input"
              label={t('add.tagLabel')}
              placeholder="ABC12345"
              value={value}
              // 태그는 영문 대문자·숫자라 한글 자판 대신 영문 자판을 띄우고, 소문자로 쳐도 대문자로 맞춘다
              onChange={(text) => onChange(text.toUpperCase())}
              autoFocus
              {...ASCII_CODE_TEXT_INPUT_PROPS}
              maxLength={USER_TAG_MAX_LENGTH}
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={error != null}
              errorMessage={resolveValidationMessage(error, {
                default: 'userTag.pattern',
                byType: { too_small: 'userTag.length', too_big: 'userTag.length' },
              })}
              onSubmitEditing={() => {
                if (isValid && !isSubmitting) {
                  submit();
                }
              }}
            />
          )}
        />
      </StyledSafeAreaView>
    </FormScrollView>
  );
}
