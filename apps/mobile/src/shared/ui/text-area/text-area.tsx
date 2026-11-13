import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { cn } from '@src/shared/utils/cn';
import {
  type ComponentRef,
  use,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { TextInput, type View } from 'react-native';
import { withUniwind } from 'uniwind';

import { Box } from '../box/box';
import { HStack } from '../h-stack/h-stack';
import { type FocusedFieldNode, useReportFocusedField } from '../input/focused-field';
import { Text } from '../text/text';
import { TEXT_SIZE_CLASSES } from '../text/text.variants';
import { VStack } from '../v-stack/v-stack';
import { FieldMaxHeightContext } from './field-max-height';
import type { TextAreaInternalProps } from './text-area.types';
import {
  TEXT_AREA_TEXT_SIZES,
  textAreaContainerVariants,
  textAreaLabelVariants,
  textAreaTextVariants,
} from './text-area.variants';

const StyledTextInput = withUniwind(TextInput);

export function TextArea({
  ref,
  variant = 'filled',
  label,
  isDisabled = false,
  isInvalid = false,
  errorMessage,
  counter,
  preserveErrorSpace = true,
  textSize,
  growsWithContent = false,
  placeholder,
  className,
  textInputComponent,
  value,
  onChange,
  onFocus,
  onBlur,
  onLayout,
  onContentSizeChange,
  ...props
}: TextAreaInternalProps) {
  const [isFocused, setIsFocused] = useState(false);
  const fieldRef = useRef<FocusedFieldNode | null>(null);
  const reportFocusedField = useReportFocusedField(fieldRef);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [verticalChromeHeight, setVerticalChromeHeight] = useState<number | null>(null);
  const getMaxFieldHeight = use(FieldMaxHeightContext);
  const containerRef = useRef<ComponentRef<typeof View> | null>(null);
  const [maxContainerHeight, setMaxContainerHeight] = useState<number | null>(null);
  // 칸 전체와 입력 칸을 같은 배치에서 동기로 재야 라벨·오류 문구 몫이 어긋나지 않아 상한이 흔들리지 않는다
  const measureMaxContainerHeight = () => {
    const field = fieldRef.current;
    const container = containerRef.current;
    if (!growsWithContent || getMaxFieldHeight == null || field == null || container == null) {
      return;
    }
    field.measure((_x, _y, _width, fieldHeight) =>
      container.measure((_containerX, _containerY, _containerWidth, containerHeight) => {
        const maxFieldHeight = getMaxFieldHeight(fieldHeight);
        setMaxContainerHeight(
          maxFieldHeight == null ? null : maxFieldHeight - (fieldHeight - containerHeight),
        );
      }),
    );
  };
  const handleMaxFieldHeightChange = useEffectEvent(measureMaxContainerHeight);
  useLayoutEffect(() => {
    handleMaxFieldHeightChange();
  }, [getMaxFieldHeight]);
  const layoutMeasurementsRef = useRef<{
    containerHeight?: number;
    inputHeight?: number;
  }>({});
  const hasMeasuredVerticalChromeRef = useRef(false);
  const { resolveSize } = useFontScale();
  const InputComponent = textInputComponent ?? StyledTextInput;
  const resolvedTextSize = textSize == null ? undefined : resolveSize(textSize);
  const growingContainerStyle =
    growsWithContent && contentHeight != null && verticalChromeHeight != null
      ? {
          height: Math.min(
            Math.ceil(contentHeight + verticalChromeHeight),
            maxContainerHeight ?? Infinity,
          ),
        }
      : undefined;

  const recordLayoutMeasurement = useCallback(
    (measurement: { containerHeight: number } | { inputHeight: number }) => {
      if (!growsWithContent || hasMeasuredVerticalChromeRef.current) {
        return;
      }

      layoutMeasurementsRef.current = { ...layoutMeasurementsRef.current, ...measurement };
      const { containerHeight, inputHeight } = layoutMeasurementsRef.current;
      if (containerHeight == null || inputHeight == null) {
        return;
      }

      hasMeasuredVerticalChromeRef.current = true;
      setVerticalChromeHeight(Math.max(containerHeight - inputHeight, 0));
    },
    [growsWithContent],
  );

  return (
    <Box
      ref={fieldRef}
      className={cn('gap-2', variant === 'bare' && 'flex-1')}
      onLayout={() => {
        // 내용에 맞춰 자라거나 오류 문구가 늘면 칸 전체를 다시 알린다
        if (isFocused) {
          reportFocusedField(true);
        }
        measureMaxContainerHeight();
      }}
    >
      {label != null && label.length > 0 && (
        <Text size="e1" weight="medium" className={textAreaLabelVariants({ isFocused, isInvalid })}>
          {label}
        </Text>
      )}
      <VStack gap={4} className={cn(variant === 'bare' && 'flex-1')}>
        <Box
          ref={containerRef}
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
            value={value}
            onChangeText={onChange}
            allowFontScaling={false}
            placeholder={placeholder}
            editable={!isDisabled}
            multiline
            scrollEnabled={growsWithContent ? true : undefined}
            textAlignVertical="top"
            className={cn(
              textAreaTextVariants({
                variant,
                fontSize: resolveSize(TEXT_AREA_TEXT_SIZES[variant]),
              }),
              resolvedTextSize == null ? undefined : TEXT_SIZE_CLASSES[resolvedTextSize],
            )}
            onFocus={(event) => {
              setIsFocused(true);
              reportFocusedField(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              reportFocusedField(false);
              onBlur?.(event);
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
        </Box>
        {(preserveErrorSpace || errorMessage != null || counter != null) && (
          <HStack className="gap-2">
            <Text size="e1" className={cn('flex-1 text-error', !errorMessage && 'opacity-0')}>
              {errorMessage ?? ' '}
            </Text>
            {counter}
          </HStack>
        )}
      </VStack>
    </Box>
  );
}
