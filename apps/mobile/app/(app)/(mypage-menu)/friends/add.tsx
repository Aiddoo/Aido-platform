import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/social/friend/queries/friend.mutations';
import {
  addFriendFormSchema,
  EMPTY_ADD_FRIEND_FORM_VALUES,
  USER_TAG_MAX_LENGTH,
} from '@src/features/social/friend/schemas/add-friend-form.schema';
import { useGetInviteAvailabilityQueryOptions } from '@src/features/social/invite/queries/invite.queries';
import { ASCII_CODE_TEXT_INPUT_PROPS } from '@src/shared/constants/text-input.constants';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
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
import { useMutation, usePrefetchQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { ScrollView } from 'react-native';

function AddFriendScreen() {
  const goBack = useSingleTap(router.back);

  const { t } = useTranslation('friend');
  const reportUnexpectedError = useReportUnexpectedError('friend');
  const sendRequest = useMutation(useSendRequestByTagMutationOptions());
  // 친구 한도 안내에 초대로 자리를 늘리는 길을 보여 줄지 미리 알아 둔다
  usePrefetchQuery(useGetInviteAvailabilityQueryOptions());

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
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  return (
    <>
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
                    if (isValid) {
                      submit();
                    }
                  }}
                />
              )}
            />
          </StyledSafeAreaView>
        </ScrollView>

        <KeyboardAdaptiveButton
          onPress={() => submit()}
          isDisabled={!isValid}
          isLoading={isSubmitting}
          testID="friend-tag-submit"
        >
          {t('add.submit')}
        </KeyboardAdaptiveButton>
      </Box>
    </>
  );
}

export default function AddFriendRoute() {
  return (
    <QueryErrorBoundary>
      <AddFriendScreen />
    </QueryErrorBoundary>
  );
}
