import { USER_PROFILE_LIMITS } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateProfileMutationOptions } from '@src/features/identity/user/queries/user.mutations';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { updateNameFormSchema } from '@src/features/identity/user/schemas/update-name-form.schema';
import { SERVER_VALUES_RESET_OPTIONS } from '@src/shared/constants/server-values-reset-options';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FormStepLayout,
  Input,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  QueryErrorFallback,
  ReadableContent,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack, useNavigation } from 'expo-router';
import { Suspense } from 'react';
import { Controller, FormState, useForm } from 'react-hook-form';
import { match, P } from 'ts-pattern';

export default function EditNameScreen() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.editName') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <QueryErrorBoundary fallback={EditName.Error}>
            {/* 내 정보는 마이페이지에서 이미 불러와 캐시에서 바로 읽혀 따로 보여 줄 로딩이 없다 */}
            <Suspense fallback={<Box className="flex-1" />}>
              <EditName />
            </Suspense>
          </QueryErrorBoundary>
        </ReadableContent>
      </Box>
    </>
  );
}

function EditName() {
  const { t } = useTranslation('user');
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/settings/profile' });
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfile = useMutation(useUpdateProfileMutationOptions());
  // 칸과 버튼이 그 조각만 구독해 글자를 쳐도 여기는 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(updateNameFormSchema),
    // 다른 기기에서 바뀐 이름이 다시 받아지면 따라가되, 고치는 중인 글자는 덮지 않는다
    values: { name: user.name },
    resetOptions: SERVER_VALUES_RESET_OPTIONS,
    mode: 'onChange',
  });

  const submitName = form.handleSubmit(async ({ name }) => {
    await updateProfile.mutateAsync({ name });
    // 저장하는 동안 이미 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
    if (navigation.isFocused()) {
      goBack();
    }
  });
  // 실패하면 토스트는 mutation의 meta.errorFeedback이 한 번 알리고 화면과 입력값은 그대로 둔다
  const handleSavePress = useSingleTap(() => {
    submitName().catch(noop);
  });

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={t('editName.header')}
        footer={
          <FormState
            control={form.control}
            render={({ isSubmitting, isValid, isDirty }) => (
              <KeyboardAdaptiveButton
                testID="edit-name-submit"
                onPress={handleSavePress}
                isDisabled={!(isValid && isDirty)}
                isLoading={isSubmitting}
              >
                {t('editName.submit')}
              </KeyboardAdaptiveButton>
            )}
          />
        }
      >
        <Controller
          control={form.control}
          name="name"
          render={({
            field: { value, onChange, ref },
            fieldState: { error },
            formState: { isValid, isDirty },
          }) => (
            <Input
              ref={ref}
              testID="edit-name-input"
              label={t('editName.label')}
              placeholder={t('editName.placeholder')}
              value={value}
              onChange={onChange}
              autoFocus
              autoCapitalize="none"
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={error != null}
              errorMessage={match(error)
                .with(P.nullish, () => undefined)
                .with({ type: 'too_big' }, () =>
                  t('editName.maxLength', { count: USER_PROFILE_LIMITS.NAME_MAX_LENGTH }),
                )
                .otherwise(() => t('editName.required'))}
              onSubmitEditing={() => {
                if (isValid && isDirty) {
                  handleSavePress();
                }
              }}
            />
          )}
        />
      </FormStepLayout>
    </Box>
  );
}

EditName.Error = QueryErrorFallback;
