import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import { forwardRef, useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { Text } from '../Text/Text';
import { textSizeClasses } from '../Text/Text.variants';
import { VStack } from '../VStack/VStack';
import type { TextAreaInternalProps } from './TextArea.types';
import {
  textAreaContainerVariants,
  textAreaLabelVariants,
  textAreaTextVariants,
} from './TextArea.variants';

const StyledTextInput = withUniwind(TextInput);

export const TextArea = forwardRef<TextInput, TextAreaInternalProps>(
  (
    {
      variant = 'filled',
      label,
      isDisabled = false,
      isInvalid = false,
      errorMessage,
      preserveErrorSpace = true,
      textSize,
      growsWithContent = false,
      placeholder,
      className,
      textInputComponent,
      onFocus,
      onBlur,
      onLayout,
      onContentSizeChange,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [contentHeight, setContentHeight] = useState<number | null>(null);
    const [verticalChromeHeight, setVerticalChromeHeight] = useState<number | null>(null);
    const layoutMeasurementsRef = useRef<{
      containerHeight?: number;
      inputHeight?: number;
    }>({});
    const hasMeasuredVerticalChromeRef = useRef(false);
    const { resolveSize } = useFontScale();
    const InputComponent = textInputComponent ?? StyledTextInput;
    const resolvedTextSize = textSize === undefined ? undefined : resolveSize(textSize);
    const growingContainerStyle =
      growsWithContent && contentHeight !== null && verticalChromeHeight !== null
        ? { height: Math.ceil(contentHeight + verticalChromeHeight) }
        : undefined;

    const recordLayoutMeasurement = useCallback(
      (measurement: { containerHeight: number } | { inputHeight: number }) => {
        if (!growsWithContent || hasMeasuredVerticalChromeRef.current) {
          return;
        }

        layoutMeasurementsRef.current = { ...layoutMeasurementsRef.current, ...measurement };
        const { containerHeight, inputHeight } = layoutMeasurementsRef.current;
        if (containerHeight === undefined || inputHeight === undefined) {
          return;
        }

        hasMeasuredVerticalChromeRef.current = true;
        setVerticalChromeHeight(Math.max(containerHeight - inputHeight, 0));
      },
      [growsWithContent],
    );

    return (
      <View className="gap-2">
        {label && (
          <Text
            size="e1"
            weight="medium"
            className={textAreaLabelVariants({ isFocused, isInvalid })}
          >
            {label}
          </Text>
        )}
        <VStack gap={4}>
          <View
            style={growingContainerStyle}
            className={cn(
              textAreaContainerVariants({ variant, isFocused, isDisabled, isInvalid }),
              className,
            )}
            onLayout={(event) => {
              recordLayoutMeasurement({ containerHeight: event.nativeEvent.layout.height });
            }}
          >
            <InputComponent
              ref={ref}
              allowFontScaling={false}
              placeholder={placeholder}
              editable={!isDisabled}
              multiline
              scrollEnabled={growsWithContent ? true : undefined}
              textAlignVertical="top"
              className={cn(
                textAreaTextVariants({ variant }),
                resolvedTextSize === undefined ? undefined : textSizeClasses[resolvedTextSize],
              )}
              onFocus={(e) => {
                setIsFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              onLayout={(event) => {
                recordLayoutMeasurement({ inputHeight: event.nativeEvent.layout.height });
                onLayout?.(event);
              }}
              onContentSizeChange={(event) => {
                if (growsWithContent) {
                  setContentHeight(event.nativeEvent.contentSize.height);
                }
                onContentSizeChange?.(event);
              }}
              {...props}
            />
          </View>
          {(preserveErrorSpace || errorMessage !== undefined) && (
            <Text size="e1" className={cn('text-error', !errorMessage && 'opacity-0')}>
              {errorMessage ?? ' '}
            </Text>
          )}
        </VStack>
      </View>
    );
  },
);

TextArea.displayName = 'TextArea';
