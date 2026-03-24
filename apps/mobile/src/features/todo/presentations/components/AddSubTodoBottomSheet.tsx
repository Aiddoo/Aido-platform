import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSpeechRecognition } from '@src/shared/hooks/useSpeechRecognition';
import {
  ArrowUpIcon,
  BottomSheetInput,
  Box,
  HStack,
  InfoIcon,
  KeyboardBottomSheet,
  MicIcon,
  PauseIcon,
  Text,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { Popover, PressableFeedback, Spinner } from 'heroui-native';
import { useRef, useState } from 'react';
import { Keyboard, type TextInput } from 'react-native';
import { match } from 'ts-pattern';

interface BaseProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
}

interface CreateProps extends BaseProps {
  mode: 'create';
  onSubmit: (value: string) => void;
  isSubmitting: boolean;
}

interface EditProps extends BaseProps {
  mode: 'edit';
  initialValue: string;
  onSubmit: (value: string) => void;
  onDelete: () => void;
  isSubmitting: boolean;
}

type AddSubTodoBottomSheetProps = CreateProps | EditProps;

export const AddSubTodoBottomSheet = (props: AddSubTodoBottomSheetProps) => {
  const { isOpen, onOpenChange, onClose } = props;

  const defaultValue = match(props)
    .with({ mode: 'edit' }, ({ initialValue }) => initialValue)
    .with({ mode: 'create' }, () => '')
    .exhaustive();

  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);

  const isSubmitDisabled = !value.trim() || props.isSubmitting;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    props.onSubmit(trimmed);
    if (props.mode === 'create') setValue('');
  };

  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <VStack gap={12}>
        <BottomSheetInput
          ref={inputRef}
          autoFocus
          placeholder="항목을 입력하세요"
          value={value}
          onChangeText={setValue}
          maxLength={200}
          size="medium"
          renderErrorMessage={false}
          returnKeyType="done"
          onSubmitEditing={isSubmitDisabled ? onClose : handleSubmit}
        />

        <Box className="h-px bg-gray-2" />

        <HStack gap={8} align="center">
          {props.mode === 'edit' && (
            <PressableFeedback
              onPress={props.onDelete}
              isDisabled={props.isSubmitting}
              className="size-9 items-center justify-center rounded-full bg-error/10"
            >
              <TrashIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-error"
              />
            </PressableFeedback>
          )}

          <Box className="flex-1" />

          <SpeechTooltip />
          <SpeechButton onResult={setValue} />
          <PressableFeedback
            isDisabled={isSubmitDisabled}
            onPress={handleSubmit}
            style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
            className={cn(
              'items-center justify-center rounded-4xl',
              isSubmitDisabled ? 'bg-gray-3' : 'bg-main',
            )}
          >
            {props.isSubmitting ? (
              <Spinner size="sm" color="white" />
            ) : (
              <ArrowUpIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-white"
              />
            )}
          </PressableFeedback>
        </HStack>
      </VStack>
    </KeyboardBottomSheet>
  );
};

function SpeechTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <PressableFeedback onPress={() => setIsOpen(true)} className="items-center justify-center">
          <HStack gap={4} align="center">
            <Text size="e2" weight="medium" shade={6}>
              음성 입력
            </Text>

            <InfoIcon
              width={fontScaledSize(16)}
              height={fontScaledSize(16)}
              colorClassName="text-gray-6"
            />
          </HStack>
        </PressableFeedback>
      </Popover.Trigger>
      <Popover.Portal disableFullWindowOverlay={false}>
        <Popover.Overlay />
        <Popover.Content
          presentation="popover"
          placement="top"
          align="end"
          avoidCollisions={false}
          className="rounded-2xl border border-border px-4 py-3"
        >
          <Popover.Arrow />
          <VStack gap={4}>
            <HStack gap={4} align="center">
              <MicIcon
                width={fontScaledSize(18)}
                height={fontScaledSize(18)}
                colorClassName="text-main"
              />

              <Text size="b3" weight="semibold" maxFontSizeMultiplier={2}>
                음성으로 입력해요
              </Text>
            </HStack>

            <Text size="b3" shade={6} maxFontSizeMultiplier={2}>
              마이크 버튼을 누르고 말하면{'\n'}음성이 텍스트로 입력돼요
            </Text>
          </VStack>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

interface SpeechButtonProps {
  onResult: (text: string) => void;
}

function SpeechButton({ onResult }: SpeechButtonProps) {
  const toast = useAppToast();

  const { isRecognizing, start, stop } = useSpeechRecognition({
    onResult,
    onEnd: () => {},
    onError: toast.error,
  });

  const handlePress = () => {
    if (isRecognizing) {
      stop();
      return;
    }
    Keyboard.dismiss();
    start();
  };

  return (
    <PressableFeedback
      onPress={handlePress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className="items-center justify-center rounded-full bg-main/10"
    >
      {isRecognizing ? (
        <PauseIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-error"
        />
      ) : (
        <MicIcon
          width={fontScaledSize(20)}
          height={fontScaledSize(20)}
          colorClassName="text-main"
        />
      )}
    </PressableFeedback>
  );
}
