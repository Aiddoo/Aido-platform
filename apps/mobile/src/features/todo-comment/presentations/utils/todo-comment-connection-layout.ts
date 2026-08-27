import type { TodoConversationConnection } from '../../models/todo-comment.model';

export const TODO_COMMENT_CONNECTION_GEOMETRY = {
  maxVisibleDepth: 4,
  depthIndent: 30,
  railColumnWidth: 36,
  railAxis: 18,
  railWidth: 2,
  rowVerticalPadding: 14,
  avatarGap: 4,
} as const;

export interface TodoCommentVerticalLaneLayout {
  x: number;
  top: number;
  bottom?: number;
  height?: number;
}

export interface TodoCommentIncomingBranchLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}

export interface TodoCommentConnectionLayout {
  railWidth: number;
  avatarLeft: number;
  avatarTop: number;
  minimumHeight: number;
  upperLanes: TodoCommentVerticalLaneLayout[];
  lowerLanes: TodoCommentVerticalLaneLayout[];
  incomingBranch: TodoCommentIncomingBranchLayout | null;
}

function toVisibleDepth(depth: number): number {
  return Math.min(depth, TODO_COMMENT_CONNECTION_GEOMETRY.maxVisibleDepth);
}

function toLaneX(depth: number): number {
  return (
    TODO_COMMENT_CONNECTION_GEOMETRY.railAxis +
    toVisibleDepth(depth) * TODO_COMMENT_CONNECTION_GEOMETRY.depthIndent
  );
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

export function getTodoCommentConnectionLayout(
  connection: TodoConversationConnection,
  avatarSize: number,
): TodoCommentConnectionLayout {
  const currentLaneX = toLaneX(connection.visualDepth);
  const avatarTop = TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding;
  const avatarLeft = currentLaneX - avatarSize / 2;
  const avatarCenterY = avatarTop + avatarSize / 2;
  const avatarUpperGapY = avatarTop - TODO_COMMENT_CONNECTION_GEOMETRY.avatarGap;
  const avatarLowerGapY = avatarTop + avatarSize + TODO_COMMENT_CONNECTION_GEOMETRY.avatarGap;
  const incomingFromX =
    connection.incomingBranch === null ? null : toLaneX(connection.incomingBranch.fromDepth);
  const incomingTargetX =
    connection.incomingBranch === null ? null : toLaneX(connection.incomingBranch.toDepth);
  const hasVisibleIncomingBranch =
    incomingFromX !== null && incomingTargetX !== null && incomingFromX !== incomingTargetX;

  const upperLanes = uniqueNumbers(connection.upperLaneDepths.map(toLaneX))
    .filter((x) => !hasVisibleIncomingBranch || x !== incomingFromX)
    .map((x) => ({
      x,
      top: 0,
      height: x === currentLaneX ? avatarUpperGapY : avatarCenterY,
    }));

  const lowerLanes = uniqueNumbers(connection.lowerLaneDepths.map(toLaneX)).map((x) => ({
    x,
    top: x === currentLaneX ? avatarLowerGapY : avatarCenterY,
    bottom: 0,
  }));

  const branchEndX = avatarLeft - TODO_COMMENT_CONNECTION_GEOMETRY.avatarGap;
  const branchWidth = incomingFromX === null ? 0 : branchEndX - incomingFromX;
  const incomingBranch =
    !hasVisibleIncomingBranch || incomingFromX === null || branchWidth <= 0
      ? null
      : {
          left: incomingFromX,
          top: 0,
          width: branchWidth,
          height: avatarCenterY,
          radius: Math.min(12, branchWidth),
        };

  return {
    railWidth:
      TODO_COMMENT_CONNECTION_GEOMETRY.railColumnWidth +
      toVisibleDepth(connection.visualDepth) * TODO_COMMENT_CONNECTION_GEOMETRY.depthIndent,
    avatarLeft,
    avatarTop,
    minimumHeight: avatarSize + TODO_COMMENT_CONNECTION_GEOMETRY.rowVerticalPadding * 2,
    upperLanes,
    lowerLanes,
    incomingBranch,
  };
}
