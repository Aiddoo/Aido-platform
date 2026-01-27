import { PressableFeedback, Spinner } from 'heroui-native';
import { TextInput, type TextInputProps, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useBlinkAnimation } from '../../hooks/useBlinkAnimation';
import { HStack } from '../HStack/HStack';
import { MicIcon, PauseIcon, SendIcon } from '../Icon';

export interface VoiceTextFieldProps
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'editable'> {
  value: string;
  onChangeText: (text: string) => void;
  onMicPress: () => void;
  onSubmit: () => void;
  isRecognizing: boolean;
  isLoading?: boolean;
  recognizingPlaceholder?: string;
  recognizingPlaceholderColor?: string;
  micIconColor?: string;
  recordingIconColor?: string;
  hideMicButton?: boolean;
  hideSendButton?: boolean;
  maxLength?: number;
  containerClassName?: string;
}

export const VoiceTextField = ({
  value,
  onChangeText,
  onMicPress,
  onSubmit,
  isRecognizing,
  isLoading = false,
  placeholder,
  recognizingPlaceholder = '듣고 있어요...',
  recognizingPlaceholderColor = '#EF4444',
  micIconColor = '#F97316',
  recordingIconColor = '#EF4444',
  hideMicButton = false,
  hideSendButton = false,
  maxLength = 500,
  containerClassName,
  ...textInputProps
}: VoiceTextFieldProps) => {
  const hasText = value.trim().length > 0;
  const isInputDisabled = isLoading || isRecognizing;

  const displayPlaceholder = isRecognizing ? recognizingPlaceholder : placeholder;
  const placeholderColor = isRecognizing ? recognizingPlaceholderColor : '#9CA3AF';

  return (
    <HStack
      align="center"
      gap={12}
      className={
        containerClassName ?? 'px-4 py-3 bg-white rounded-full border border-gray-2 shadow-sm'
      }
    >
      <RecordingIndicator isActive={isRecognizing} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={displayPlaceholder}
        placeholderTextColor={placeholderColor}
        className="flex-1"
        style={{ fontSize: 15, flex: 1 }}
        maxLength={maxLength}
        editable={!isInputDisabled}
        {...textInputProps}
      />

      {!hideMicButton && (
        <MicButton
          onPress={onMicPress}
          isRecognizing={isRecognizing}
          isDisabled={isLoading}
          micIconColor={micIconColor}
          recordingIconColor={recordingIconColor}
        />
      )}

      {!hideSendButton && <SendButton onPress={onSubmit} hasText={hasText} isLoading={isLoading} />}
    </HStack>
  );
};

interface RecordingIndicatorProps {
  isActive: boolean;
}

const RecordingIndicator = ({ isActive }: RecordingIndicatorProps) => {
  const animatedStyle = useBlinkAnimation(isActive);

  if (!isActive) return null;

  return (
    <Animated.View style={animatedStyle}>
      <View className="size-3 rounded-full bg-red-500" />
    </Animated.View>
  );
};

interface MicButtonProps {
  onPress: () => void;
  isRecognizing: boolean;
  isDisabled?: boolean;
  micIconColor?: string;
  recordingIconColor?: string;
  iconSize?: number;
}

const MicButton = ({
  onPress,
  isRecognizing,
  isDisabled = false,
  micIconColor = '#F97316',
  recordingIconColor = '#EF4444',
  iconSize = 22,
}: MicButtonProps) => {
  return (
    <PressableFeedback
      onPress={onPress}
      className="items-center justify-center"
      isDisabled={isDisabled}
    >
      {isRecognizing ? (
        <PauseIcon width={iconSize} height={iconSize} color={recordingIconColor} />
      ) : (
        <MicIcon width={iconSize} height={iconSize} color={micIconColor} />
      )}
    </PressableFeedback>
  );
};

interface SendButtonProps {
  onPress: () => void;
  hasText: boolean;
  isLoading: boolean;
  size?: number;
}

const SendButton = ({ onPress, hasText, isLoading, size = 32 }: SendButtonProps) => {
  const isDisabled = !hasText || isLoading;
  const buttonClassName =
    hasText && !isLoading
      ? 'size-8 items-center justify-center rounded-full bg-main'
      : 'size-8 items-center justify-center rounded-full bg-gray-3';

  return (
    <PressableFeedback
      onPress={onPress}
      className={buttonClassName}
      style={{ width: size, height: size }}
      isDisabled={isDisabled}
    >
      {isLoading ? (
        <Spinner size="sm" color="white" />
      ) : (
        <SendIcon width={16} height={16} color="white" />
      )}
    </PressableFeedback>
  );
};
