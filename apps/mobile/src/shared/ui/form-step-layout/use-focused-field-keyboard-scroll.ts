import { useCallback, useEffect, useRef, useState } from 'react';
import { findNodeHandle, type HostInstance, TextInput } from 'react-native';
import {
  KeyboardController,
  useFocusedInputHandler,
  useKeyboardHandler,
  useReanimatedFocusedInput,
  useWindowDimensions,
} from 'react-native-keyboard-controller';
import type Animated from 'react-native-reanimated';
import {
  measure,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';

import type { FocusedFieldNode } from '../input/focused-field';
import {
  getCaretScrollDelta,
  getFocusedFieldScrollDelta,
  type VerticalSpan,
} from './get-focused-field-scroll-delta';

// 칸 아래 끝(오류 문구·글자 수)과 키보드 위 버튼 사이
const FIELD_GAP_ABOVE_FOOTER = 8;

/** 스크롤 내용 기준 좌표라 스크롤해도 바뀌지 않는다 */
interface FocusedFieldInContent {
  top: number;
  bottom: number;
  inputTop: number;
  inputHeight: number;
}

/** 키보드가 fromHeight → toHeight로 움직이는 동안 스크롤을 fromScroll에서 목표까지 같은 비율로 옮긴다 */
interface KeyboardTransition {
  fromHeight: number;
  toHeight: number;
  fromScroll: number;
  hasMoved: boolean;
}

/** 입력 TextInput 기준 커서 줄. 어느 입력의 것인지(target) 함께 둔다 */
interface CaretInInput extends VerticalSpan {
  target: number;
}

function measureInContent(node: Pick<HostInstance, 'measureLayout'>, content: HostInstance) {
  return new Promise<VerticalSpan>((resolve, reject) => {
    node.measureLayout(
      content,
      (_left, top, _width, height) => resolve({ top, bottom: top + height }),
      reject,
    );
  });
}

function clampToInput(value: number, inputHeight: number) {
  'worklet';
  return Math.min(Math.max(value, 0), inputHeight);
}

/**
 * 화면 폼에서 포커스한 칸 전체(라벨·입력 칸·오류 문구·글자 수)를 키보드와 키보드 위 버튼 사이에 보이게 한다.
 * `KeyboardAwareScrollView`는 커서 줄만 키보드 위로 올리므로(여러 줄 입력의 아래쪽·오류 문구는 버튼에 가린다)
 * 같은 라이브러리의 키보드·포커스 이벤트로 칸 전체를 기준 삼아 키보드와 같은 프레임에 UI 스레드에서 스크롤한다.
 * 키보드 높이가 뒤늦게 바뀌어도(암호 자동 완성 줄, Writing Tools, 병음 후보 줄) 새 높이로 다시 맞춘다
 */
export function useFocusedFieldKeyboardScroll() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const { height: windowHeight } = useWindowDimensions();
  const { input } = useReanimatedFocusedInput();
  const footerHeight = useSharedValue(0);
  const field = useSharedValue<FocusedFieldInContent | null>(null);
  const caret = useSharedValue<CaretInInput | null>(null);
  // 화면이 열릴 때 이미 떠 있던 키보드(이전 화면에서 열린 키보드)도 기준으로 삼는다
  const [initialKeyboardHeight] = useState(() => KeyboardController.state().height);
  const keyboardHeight = useSharedValue(initialKeyboardHeight);
  const currentKeyboardHeight = useSharedValue(initialKeyboardHeight);
  const keyboardSpace = useSharedValue(initialKeyboardHeight);
  const transition = useSharedValue<KeyboardTransition | null>(null);
  const scrollBeforeKeyboard = useSharedValue(0);
  const focusedFieldRef = useRef<FocusedFieldNode | null>(null);
  const scrollViewTag = useSharedValue(-1);

  useEffect(() => {
    scrollViewTag.set(findNodeHandle(scrollRef.current) ?? -1);
  }, [scrollRef, scrollViewTag]);

  /** 칸 전체를 알리지 않는 입력(코드 입력처럼 숨은 TextInput)은 이 스크롤 안에 있을 때 입력 자체를 칸으로 본다 */
  const getFocusedField = useCallback(
    (fromScroll: number, viewportTop: number): FocusedFieldInContent | null => {
      'worklet';
      const reported = field.get();
      if (reported != null) {
        return reported;
      }
      const focusedInput = input.get();
      if (focusedInput == null || focusedInput.parentScrollViewTarget !== scrollViewTag.get()) {
        return null;
      }
      // 포커스한 순간의 창 좌표다. 키보드가 움직이기 시작할 때까지는 스크롤하지 않았으므로 fromScroll 기준으로 바꾼다
      const top = focusedInput.layout.absoluteY - viewportTop + fromScroll;
      return {
        top,
        bottom: top + focusedInput.layout.height,
        inputTop: top,
        inputHeight: focusedInput.layout.height,
      };
    },
    [field, input, scrollViewTag],
  );

  const getVisibleSpan = useCallback(
    (viewportTop: number, viewportHeight: number, keyboard: number): VerticalSpan => {
      'worklet';
      return {
        top: viewportTop,
        bottom:
          Math.min(viewportTop + viewportHeight, windowHeight - keyboard - footerHeight.get()) -
          FIELD_GAP_ABOVE_FOOTER,
      };
    },
    [footerHeight, windowHeight],
  );

  const getCaretSpan = useCallback(
    (focused: FocusedFieldInContent, contentTop: number): VerticalSpan => {
      'worklet';
      const inputTop = contentTop + focused.inputTop;
      const caretInInput = caret.get();
      if (caretInInput == null || caretInInput.target !== input.get()?.target) {
        return { top: inputTop, bottom: inputTop };
      }
      return {
        top: inputTop + clampToInput(caretInInput.top, focused.inputHeight),
        bottom: inputTop + clampToInput(caretInInput.bottom, focused.inputHeight),
      };
    },
    [caret, input],
  );

  /** fromScroll에서 키보드가 keyboard 높이일 때 칸 전체가 보이는 스크롤 위치 */
  const getTargetScroll = useCallback(
    (fromScroll: number, keyboard: number) => {
      'worklet';
      const viewport = measure(scrollRef);
      const focused = viewport == null ? null : getFocusedField(fromScroll, viewport.pageY);
      if (focused == null || viewport == null || keyboard === 0) {
        return fromScroll;
      }
      const contentTop = viewport.pageY - fromScroll;
      const delta = getFocusedFieldScrollDelta({
        visible: getVisibleSpan(viewport.pageY, viewport.height, keyboard),
        field: { top: contentTop + focused.top, bottom: contentTop + focused.bottom },
        caret: getCaretSpan(focused, contentTop),
      });
      // 키보드 높이만큼 내용 아래를 비워 두므로 아래로는 늘 스크롤할 수 있다. 위로는 처음보다 더 올라가지 않는다
      return Math.max(fromScroll + delta, Math.min(fromScroll, 0));
    },
    [getCaretSpan, getFocusedField, getVisibleSpan, scrollRef],
  );

  const getTransitionScroll = useCallback(
    (current: KeyboardTransition, height: number) => {
      'worklet';
      const target =
        current.toHeight === 0
          ? Math.min(current.fromScroll, scrollBeforeKeyboard.get())
          : getTargetScroll(current.fromScroll, current.toHeight);
      const progress =
        current.toHeight === current.fromHeight
          ? 1
          : Math.min(
              Math.max((height - current.fromHeight) / (current.toHeight - current.fromHeight), 0),
              1,
            );
      return current.fromScroll + (target - current.fromScroll) * progress;
    },
    [getTargetScroll, scrollBeforeKeyboard],
  );

  useKeyboardHandler(
    {
      onStart: (event) => {
        'worklet';
        const fromScroll = scrollOffset.get();
        if (event.height > 0 && keyboardHeight.get() === 0) {
          scrollBeforeKeyboard.set(fromScroll);
        }
        // 키보드가 올라가는 동안 스크롤할 자리를 먼저 만든다. 내려갈 때는 스크롤을 되돌린 뒤 onEnd에서 지운다
        if (event.height > keyboardSpace.get()) {
          keyboardSpace.set(event.height);
        }
        transition.set({
          fromHeight: currentKeyboardHeight.get(),
          toHeight: event.height,
          fromScroll,
          hasMoved: false,
        });
        keyboardHeight.set(event.height);
      },
      onMove: (event) => {
        'worklet';
        currentKeyboardHeight.set(event.height);
        const current = transition.get();
        if (current == null) {
          return;
        }
        if (!current.hasMoved) {
          transition.set({ ...current, hasMoved: true });
        }
        // 칸 위치는 JS의 onFocus 뒤에 알게 되므로 목표를 프레임마다 다시 구한다
        scrollTo(scrollRef, 0, getTransitionScroll(current, event.height), false);
      },
      onEnd: (event) => {
        'worklet';
        currentKeyboardHeight.set(event.height);
        keyboardHeight.set(event.height);
        const current = transition.get();
        transition.set(null);
        if (current != null) {
          // 포커스만 옮긴 경우처럼 키보드가 움직이지 않았으면 onMove 없이 끝나므로 여기서 부드럽게 옮긴다
          scrollTo(
            scrollRef,
            0,
            getTransitionScroll({ ...current, toHeight: event.height }, event.height),
            !current.hasMoved,
          );
        }
        keyboardSpace.set(event.height);
      },
    },
    [getTransitionScroll],
  );

  /** 키보드가 멈춰 있을 때 칸 위치나 크기가 바뀌면(포커스 이동, 오류 문구, 자라는 입력 칸) 다시 맞춘다 */
  const revealFocusedField = useCallback(
    (next: FocusedFieldInContent | null, animated: boolean) => {
      'worklet';
      field.set(next);
      const keyboard = keyboardHeight.get();
      if (next == null || transition.get() != null || keyboard === 0) {
        return;
      }
      const fromScroll = scrollOffset.get();
      const target = getTargetScroll(fromScroll, keyboard);
      if (Math.abs(target - fromScroll) >= 1) {
        scrollTo(scrollRef, 0, target, animated);
      }
    },
    [field, getTargetScroll, keyboardHeight, scrollOffset, scrollRef, transition],
  );

  useFocusedInputHandler(
    {
      onSelectionChange: (event) => {
        'worklet';
        caret.set({
          target: event.target,
          top: event.selection.start.y,
          bottom: event.selection.end.y,
        });
        const focused = field.get();
        const keyboard = keyboardHeight.get();
        const viewport = measure(scrollRef);
        if (focused == null || viewport == null || transition.get() != null || keyboard === 0) {
          return;
        }
        const fromScroll = scrollOffset.get();
        const delta = getCaretScrollDelta(
          getVisibleSpan(viewport.pageY, viewport.height, keyboard),
          getCaretSpan(focused, viewport.pageY - fromScroll),
        );
        if (Math.abs(delta) >= 1) {
          scrollTo(scrollRef, 0, fromScroll + delta, true);
        }
      },
    },
    [getCaretSpan, getVisibleSpan],
  );

  const reportFocusedField = useCallback(
    (node: FocusedFieldNode, isFocused: boolean) => {
      if (!isFocused) {
        if (focusedFieldRef.current === node) {
          focusedFieldRef.current = null;
          runOnUI(revealFocusedField)(null, false);
        }
        return;
      }
      // 포커스를 옮겼으면 부드럽게, 같은 칸이 자란 것이면 글자가 늘어난 만큼 바로 따라간다
      const isNewField = focusedFieldRef.current !== node;
      focusedFieldRef.current = node;
      const content = scrollRef.current?.getInnerViewRef();
      const focusedInput = TextInput.State.currentlyFocusedInput();
      if (content == null || focusedInput == null) {
        return;
      }
      Promise.all([measureInContent(node, content), measureInContent(focusedInput, content)])
        .then(([fieldSpan, inputSpan]) => {
          if (focusedFieldRef.current !== node) {
            return;
          }
          runOnUI(revealFocusedField)(
            {
              top: fieldSpan.top,
              bottom: fieldSpan.bottom,
              inputTop: inputSpan.top,
              inputHeight: inputSpan.bottom - inputSpan.top,
            },
            isNewField,
          );
        })
        // 재는 사이 칸이 사라졌으면(단계 이동) 맞출 칸이 없다
        .catch(() => undefined);
    },
    [revealFocusedField, scrollRef],
  );

  const reportFooterHeight = useCallback(
    (height: number) => {
      footerHeight.set(height);
    },
    [footerHeight],
  );

  // 키보드 높이만큼 내용 아래를 비워야 마지막 칸도 키보드 위로 스크롤할 수 있다
  const keyboardSpaceStyle = useAnimatedStyle(() => ({ height: keyboardSpace.get() }));

  return { scrollRef, keyboardSpaceStyle, reportFocusedField, reportFooterHeight };
}
