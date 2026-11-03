import { Box } from '@src/shared/ui';
import { type ComponentRef, type PropsWithChildren, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import { TODO_COMMENT_AUTHOR_AVATAR_SIZE } from './todo-comment-author-avatar';
import { useTodoCommentReveal } from './todo-comment-reveal';

const ROW_PADDING_X = 16;
const ROW_PADDING_TOP = 14;
const ROW_PADDING_BOTTOM = 6;
const AVATAR_GAP = 12;
const RAIL_WIDTH = 2;
const RAIL_AVATAR_GAP = 4;
const CURVE_RADIUS = 12;
const CURVE_AVATAR_GAP = 6;
const TOGGLE_ROW_HEIGHT = 44;
const HIGHLIGHT_FADE_IN_MS = 120;
const HIGHLIGHT_FADE_OUT_MS = 600;
/** 알림으로 연 묶음으로 목록이 먼저 옮겨 간 뒤 강조한 행을 작성 바 위로 올린다 */
const HIGHLIGHT_REVEAL_DELAY_MS = 450;

/**
 * 연결선은 글자 크기에 따라 바뀌지 않는 아바타 열에만 맞춘다. 세로선은 행의 위·아래 끝에 붙어 행이 길어지면 함께 늘어난다.
 * start/end로 두어 RTL에서도 같은 쪽에 그린다.
 */
const COMMENT_AVATAR = TODO_COMMENT_AUTHOR_AVATAR_SIZE.md;
const REPLY_AVATAR = TODO_COMMENT_AUTHOR_AVATAR_SIZE.sm;
const RAIL_START = ROW_PADDING_X + COMMENT_AVATAR / 2 - RAIL_WIDTH / 2;
const TODO_COMMENT_REPLY_INSET = ROW_PADDING_X + COMMENT_AVATAR + AVATAR_GAP;
const CURVE_WIDTH = TODO_COMMENT_REPLY_INSET - CURVE_AVATAR_GAP - RAIL_START;

export type TodoCommentRailRowKind =
  | { type: 'comment'; hasReplies: boolean }
  | { type: 'reply'; isLast: boolean }
  | { type: 'toggle' };

interface TodoCommentRailRowProps extends PropsWithChildren {
  kind: TodoCommentRailRowKind;
  isHighlighted?: boolean;
}

export function TodoCommentRailRow({
  kind,
  isHighlighted = false,
  children,
}: TodoCommentRailRowProps) {
  const paddingStart = kind.type === 'comment' ? ROW_PADDING_X : TODO_COMMENT_REPLY_INSET;
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const { showAboveComposer } = useTodoCommentReveal();

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    const timer = setTimeout(() => showAboveComposer(rowRef), HIGHLIGHT_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isHighlighted, showAboveComposer]);

  return (
    <View
      ref={rowRef}
      collapsable={false}
      style={[
        styles.row,
        { paddingStart },
        kind.type === 'toggle' ? styles.toggleRow : styles.contentRow,
      ]}
    >
      {isHighlighted && <RowHighlight />}
      <Rails kind={kind} />
      {children}
    </View>
  );
}

function Rails({ kind }: { kind: TodoCommentRailRowKind }) {
  return match(kind)
    .with({ type: 'comment', hasReplies: false }, () => null)
    .with({ type: 'comment', hasReplies: true }, () => (
      <Box pointerEvents="none" style={styles.headRail} className="bg-gray-4" />
    ))
    .with({ type: 'reply' }, ({ isLast }) => (
      <>
        {!isLast && <Box pointerEvents="none" style={styles.throughRail} className="bg-gray-4" />}
        <Box
          pointerEvents="none"
          style={[styles.curve, { height: ROW_PADDING_TOP + REPLY_AVATAR / 2 }]}
          className="border-gray-4"
        />
      </>
    ))
    .with({ type: 'toggle' }, () => (
      <Box
        pointerEvents="none"
        style={[styles.curve, { height: TOGGLE_ROW_HEIGHT / 2 }]}
        className="border-gray-4"
      />
    ))
    .exhaustive();
}

function RowHighlight() {
  const opacity = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: HIGHLIGHT_FADE_IN_MS }),
      withDelay(
        TODO_COMMENT_HIGHLIGHT_DURATION_MS - HIGHLIGHT_FADE_IN_MS - HIGHLIGHT_FADE_OUT_MS,
        withTiming(0, { duration: HIGHLIGHT_FADE_OUT_MS }),
      ),
    );
  }, [opacity]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Box flex={1} className="bg-main/15" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative', paddingEnd: ROW_PADDING_X },
  contentRow: { paddingTop: ROW_PADDING_TOP, paddingBottom: ROW_PADDING_BOTTOM },
  toggleRow: { minHeight: TOGGLE_ROW_HEIGHT, justifyContent: 'center' },
  headRail: {
    position: 'absolute',
    start: RAIL_START,
    top: ROW_PADDING_TOP + COMMENT_AVATAR + RAIL_AVATAR_GAP,
    bottom: 0,
    width: RAIL_WIDTH,
    borderRadius: RAIL_WIDTH / 2,
  },
  throughRail: {
    position: 'absolute',
    start: RAIL_START,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
  },
  curve: {
    position: 'absolute',
    start: RAIL_START,
    top: 0,
    width: CURVE_WIDTH,
    borderStartWidth: RAIL_WIDTH,
    borderBottomWidth: RAIL_WIDTH,
    borderBottomStartRadius: CURVE_RADIUS,
  },
});
