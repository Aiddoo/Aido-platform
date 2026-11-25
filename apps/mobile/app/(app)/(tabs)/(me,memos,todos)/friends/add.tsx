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
import { useNavigation, useRouter } from 'expo-router';
import { Controller, FormState, useForm } from 'react-hook-form';

export default function AddFriendScreen() {
  const { t } = useTranslation('friend');
  const router = useRouter();
  const navigation = useNavigation();
  const goBack = useSingleTap(router.back);
  const onFriendLimitInvite = useFriendLimitInvite();
  const promptFriendLimit = useFriendLimitPrompt({ onFriendLimitInvite });
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  const form = useForm({
    resolver: zodResolver(addFriendFormSchema),
    defaultValues: EMPTY_ADD_FRIEND_FORM_VALUES,
    mode: 'onChange',
  });

  const saveFriendRequest = form.handleSubmit(async ({ userTag }) => {
    await sendRequest.mutateAsync(userTag);
    // 보내는 사이 밀어서 떠났으면 지금 보이는 이전 화면을 한 번 더 닫지 않고,
    // 돌아왔을 때 보낸 태그로 같은 요청을 또 보내지 않게 폼을 비운다
    if (!navigation.isFocused()) {
      form.reset();
      return;
    }
    goBack();
  });
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다.
  // 실패 안내는 mutation의 meta.errorFeedback이, 한도 안내는 여기서 한 번 하고 태그는 그대로 둔다
  const handleSavePress = useSingleTap(() => {
    saveFriendRequest().catch(promptFriendLimit);
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
            render={({ isSubmitting, isValid }) => (
              <KeyboardAdaptiveButton
                onPress={handleSavePress}
                isDisabled={!isValid}
                isLoading={isSubmitting}
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
              formState: { isSubmitting, isValid },
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
                  if (isValid && !isSubmitting) {
                    handleSavePress();
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
