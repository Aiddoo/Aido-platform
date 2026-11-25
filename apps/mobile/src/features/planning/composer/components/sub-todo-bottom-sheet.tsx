import { TODO_LIMITS } from '@aido/api/vocabulary';
import { DictationButton } from '@src/features/voice/components/dictation-button';
import { truncateGraphemes } from '@src/shared/domains/text-limit.model';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Input,
  HintPopoverContent,
  HStack,
  InfoIcon,
  MicIcon,
  RouteKeyboardBottomSheet,
  Text,
  VStack,
} from '@src/shared/ui';
import { Popover, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ComponentProps, type ReactNode, useState } from 'react';

interface SubTodoBottomSheetProps extends Omit<
  ComponentProps<typeof RouteKeyboardBottomSheet>,
  'fallbackHref' | 'loading' | 'children'
> {
  children: (close: () => void) => ReactNode;
}

export function SubTodoBottomSheet({ children, ...props }: SubTodoBottomSheetProps) {
  return (
    <RouteKeyboardBottomSheet
      {...props}
      fallbackHref="/feed"
      loading={<SubTodoBottomSheet.Loading />}
    >
      {(sheet) => children(() => sheet.close())}
    </RouteKeyboardBottomSheet>
  );
}

SubTodoBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={12}>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Separator thickness={1} className="bg-gray-2" />
      <Skeleton className="h-9 w-24 self-end rounded-4xl" />
    </VStack>
  );
};

// 하위 항목 제목은 서버 계약이 할 일 제목과 같은 한도로 받는다
const SUB_TODO_TITLE_MAX_LENGTH = TODO_LIMITS.TITLE_MAX_LENGTH;

type SubTodoTitleInputProps = Omit<
  ComponentProps<typeof Input>,
  'autoFocus' | 'placeholder' | 'maxLength' | 'size' | 'renderErrorMessage' | 'returnKeyType'
>;

export function SubTodoTitleInput(props: SubTodoTitleInputProps) {
  const { t } = useTranslation('todo');

  return (
    <Input
      testID="sub-todo-input"
      autoFocus
      placeholder={t('subTodo.placeholder')}
      maxLength={SUB_TODO_TITLE_MAX_LENGTH}
      size="medium"
      renderErrorMessage={false}
      returnKeyType="done"
      {...props}
    />
  );
}

interface SubTodoDictationProps {
  value: string;
  onChange: (title: string) => void;
}

export function SubTodoDictation({ value, onChange }: SubTodoDictationProps) {
  return (
    <>
      <SpeechTooltip />
      {/* 입력칸은 최대 길이를 막지만 받아쓴 글은 넘을 수 있어, 넘으면 조용히 전송이 멈추지 않게 자른다.
          한도에 걸친 이모지는 반으로 자르지 않고 그 앞까지 담는다 */}
      <DictationButton
        value={value}
        onChange={(text) => onChange(truncateGraphemes(text, SUB_TODO_TITLE_MAX_LENGTH))}
      />
    </>
  );
}

function SpeechTooltip() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('todo');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback onPress={() => setIsOpen(true)} className="items-center justify-center">
          <HStack gap={4} align="center">
            <Text size="e2" weight="medium" shade={6}>
              {t('subTodo.voiceInput')}
            </Text>

            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <HintPopoverContent
        Icon={MicIcon}
        title={t('subTodo.voiceTitle')}
        description={t('subTodo.voiceHint')}
      />
    </Popover>
  );
}
