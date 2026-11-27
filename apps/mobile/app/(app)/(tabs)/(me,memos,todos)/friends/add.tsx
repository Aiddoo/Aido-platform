import { zodResolver } from '@hookform/resolvers/zod';
import { useFriendLimitPrompt } from '@src/features/social/friend/hooks/use-friend-limit-prompt';
import { useSendRequestByTagMutationOptions } from '@src/features/social/friend/queries/friend.mutations';
import {
  addFriendFormSchema,
  EMPTY_ADD_FRIEND_FORM_VALUES,
  USER_TAG_MAX_LENGTH,
} from '@src/features/social/friend/schemas/add-friend-form.schema';
import { useFriendLimitInvite } from '@src/features/social/invite/hooks/use-friend-limit-invite';
import { ASCII_CODE_TEXT_INPUT_PROPS } from '@src/shared/constants/text-input-props';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormScrollView,
  H3,
  Input,
  KeyboardAdaptiveButton,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { Controller, FormState, useForm } from 'react-hook-form';

export default function AddFriendScreen() {
  const { t } = useTranslation('friend');
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/friends' });
  const openFriendLimitInvite = useFriendLimitInvite();
  const promptIfFriendLimitError = useFriendLimitPrompt({
    onFriendLimitInvite: openFriendLimitInvite,
  });
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  const form = useForm({
    resolver: zodResolver(addFriendFormSchema),
    defaultValues: EMPTY_ADD_FRIEND_FORM_VALUES,
    mode: 'onChange',
  });

  const submitFriendRequest = form.handleSubmit(async ({ userTag }) => {
    await sendRequest.mutateAsync(userTag);
    // 보내는 사이 떠났으면 이전 화면을 또 닫지 않고, 같은 요청을 또 보내지 않게 폼을 비운다
    if (!navigation.isFocused()) {
      form.reset();
      return;
    }
    goBack();
  });
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다. 한도 안내는 여기서 한 번 한다
  const handleSendPress = useSingleTap(() => {
    submitFriendRequest().catch(promptIfFriendLimitError);
  });

  return (
    <Box className="flex-1 bg-white">
      <FormScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        footer={
          <FormState
            control={form.control}
            render={({ isSubmitting, isSubmitSuccessful, isValid }) => (
              <KeyboardAdaptiveButton
                onPress={handleSendPress}
                isDisabled={!isValid}
                // 보내면 화면이 내려가는 동안에도 같은 태그가 남는다. 그동안 다시 보내지 않는다
                isLoading={isSubmitting || isSubmitSuccessful}
                testID="friend-tag-submit"
              >
                {t('add.submit')}
              </KeyboardAdaptiveButton>
            )}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <H3>{t('add.title')}</H3>

          <Spacing size={4} />

          <Text size="b4" shade={6}>
            {t('add.description')}
          </Text>

          <Spacing size={24} />

          <Controller
            control={form.control}
            name="userTag"
            render={({
              field: { onChange, value, ref },
              fieldState: { error },
              formState: { isSubmitting, isSubmitSuccessful, isValid },
            }) => (
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
                // 요청할 수 없는 태그면 완료 키가 키보드를 내린다. 요청할 때는 실패하면 바로 고쳐 쓰게 키보드를 둔다
                submitBehavior={isValid ? 'submit' : 'blurAndSubmit'}
                returnKeyType="done"
                isInvalid={error != null}
                errorMessage={resolveValidationMessage(error, {
                  default: 'userTag.pattern',
                  byType: { too_small: 'userTag.length', too_big: 'userTag.length' },
                })}
                onSubmitEditing={() => {
                  if (isValid && !isSubmitting && !isSubmitSuccessful) {
                    handleSendPress();
                  }
                }}
              />
            )}
          />
        </StyledSafeAreaView>
      </FormScrollView>
    </Box>
  );
}
