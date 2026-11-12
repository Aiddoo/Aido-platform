import { USER_REPORT_LIMITS, type UserReportTargetType } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  BottomSheetTextArea,
  Button,
  H4,
  HStack,
  KeyboardBottomSheet,
  SettingsListGroup,
  Text,
  useSheetRoute,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';
import { type Control, Controller, useForm, useFormState, useWatch } from 'react-hook-form';

import { isReportTargetUnavailableError } from '../domains/moderation.error';
import type { UserReportTarget } from '../domains/user-report.model';
import { useReportContentMutationOptions } from '../queries/moderation.mutations';
import {
  type UserReportFormValues,
  userReportFormSchema,
} from '../schemas/user-report-form.schema';

const TARGET_CAPTION_KEYS = {
  PROFILE: 'report.caption.PROFILE',
  TODO: 'report.caption.TODO',
  COMMENT: 'report.caption.COMMENT',
  NUDGE_MESSAGE: 'report.caption.NUDGE_MESSAGE',
  CHEER_MESSAGE: 'report.caption.CHEER_MESSAGE',
} as const satisfies Record<UserReportTargetType, string>;

type ReportReasonBottomSheetProps = Omit<
  ComponentProps<typeof KeyboardBottomSheet>,
  'children' | 'isOpen' | 'onOpenChange'
> & {
  target: UserReportTarget;
  /** 신고한 뒤 토스트의 차단 바로가기에서 확인 문구에 쓴다 */
  targetDisplayName: string;
};

/**
 * 신고 사유와 상세를 받아 신고한다. 신고하면 시트를 닫고 결과와 차단 바로가기를 토스트로 알린다.
 * 대상은 route 값을 읽는 바깥 시트(`TodoReportBottomSheet` 등)가 정하고, 이 시트는 신고 폼과 mutation만 가진다.
 */
export function ReportReasonBottomSheet({
  target,
  targetDisplayName,
  ...sheetProps
}: ReportReasonBottomSheetProps) {
  const { t } = useTranslation('moderation');
  const toast = useAppToast();
  const sheet = useSheetRoute('/feed');
  const reportContent = useMutation(useReportContentMutationOptions());
  const form = useForm({
    resolver: zodResolver(userReportFormSchema),
    defaultValues: { detail: '' },
    mode: 'onChange',
  });

  const handleReport = async (values: UserReportFormValues) => {
    try {
      await reportContent.mutateAsync({ target, form: values });
    } catch (error) {
      if (isReportTargetUnavailableError(error)) {
        sheet.close();
      }
      return;
    }

    sheet.close();
    toast.success(t('report.toast'), {
      description: t('report.toastDescription'),
      action: {
        label: t('report.toastBlockAction'),
        onPress: () =>
          router.push({
            pathname: '/users/[userId]/block',
            params: { userId: target.targetUserId, name: targetDisplayName },
          }),
      },
    });
  };

  // isSubmitting은 다음 렌더에야 켜지고 신고에는 멱등 키가 없어 같은 프레임의 두 번째 탭이 신고를 한 번 더 보낸다
  const submitReport = useSingleTap(() => form.handleSubmit(handleReport)());

  return (
    <KeyboardBottomSheet
      {...sheetProps}
      isOpen={sheet.isOpen}
      onOpenChange={sheet.onOpenChange}
      footer={<SubmitButton control={form.control} onPress={submitReport} />}
    >
      <VStack gap={16} pb={16} testID="report-reason-sheet">
        <VStack gap={2}>
          <Text size="b3" shade={7}>
            {t(TARGET_CAPTION_KEYS[target.targetType])}
          </Text>
          <H4>{t('report.title')}</H4>
        </VStack>

        <Controller
          control={form.control}
          name="reason"
          render={({ field: { onChange, value } }) => (
            <RadioGroup value={value} onValueChange={onChange} className="gap-0 overflow-hidden">
              <SettingsListGroup.Radio
                value="SPAM"
                label={t('report.reason.SPAM')}
                testID="report-reason-SPAM"
              />
              <SettingsListGroup.Radio
                value="HARASSMENT"
                label={t('report.reason.HARASSMENT')}
                testID="report-reason-HARASSMENT"
              />
              <SettingsListGroup.Radio
                value="INAPPROPRIATE"
                label={t('report.reason.INAPPROPRIATE')}
                testID="report-reason-INAPPROPRIATE"
              />
              <SettingsListGroup.Radio
                value="IMPERSONATION"
                label={t('report.reason.IMPERSONATION')}
                testID="report-reason-IMPERSONATION"
              />
              <SettingsListGroup.Radio
                value="OTHER"
                label={t('report.reason.OTHER')}
                testID="report-reason-OTHER"
              />
            </RadioGroup>
          )}
        />

        <VStack gap={6}>
          <Controller
            control={form.control}
            name="detail"
            render={({ field: { onChange, value, ref }, fieldState: { error } }) => (
              <BottomSheetTextArea
                ref={ref}
                label={t('report.detailLabel')}
                placeholder={t('report.detailPlaceholder')}
                value={value ?? ''}
                onChange={onChange}
                isInvalid={error != null}
                errorMessage={resolveValidationMessage(error, { default: 'reportDetail.tooLong' })}
                maxLength={USER_REPORT_LIMITS.MAX_DETAIL_LENGTH}
                className="h-[88px] min-h-0"
                testID="report-detail-input"
              />
            )}
          />
          <DetailLengthCounter control={form.control} />
        </VStack>

        <Text size="e1" shade={7}>
          {t('report.notice')}
        </Text>
      </VStack>
    </KeyboardBottomSheet>
  );
}

/** 상세 내용 길이만 구독해 글자를 칠 때 시트 전체가 다시 그려지지 않게 한다 */
function DetailLengthCounter({ control }: { control: Control<UserReportFormValues> }) {
  const detail = useWatch({ control, name: 'detail' });
  const { locale } = useDateFormatContext();

  return (
    <HStack justify="end">
      <Text size="e1" weight="medium" shade={7} className="tabular-nums">
        {formatCount(detail?.length ?? 0, locale)}/
        {formatCount(USER_REPORT_LIMITS.MAX_DETAIL_LENGTH, locale)}
      </Text>
    </HStack>
  );
}

interface SubmitButtonProps extends Pick<ComponentProps<typeof Button>, 'onPress'> {
  control: Control<UserReportFormValues>;
}

function SubmitButton({ control, onPress }: SubmitButtonProps) {
  const { t } = useTranslation('moderation');
  const reason = useWatch({ control, name: 'reason' });
  const { isSubmitting } = useFormState({ control });

  return (
    <Button
      color="primary"
      size="large"
      display="block"
      onPress={onPress}
      isDisabled={reason == null}
      isLoading={isSubmitting}
      testID="report-submit"
    >
      {t('report.submit')}
    </Button>
  );
}
