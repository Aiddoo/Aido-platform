import { getTodoCommentConnectionLayout } from './todo-comment-connection-layout';

describe('todo comment connection layout', () => {
  test('root는 첫 자식으로 내려가는 자기 lane만 avatar 아래에 둔다', () => {
    const layout = getTodoCommentConnectionLayout(
      {
        visualDepth: 0,
        upperLaneDepths: [],
        lowerLaneDepths: [0],
        incomingBranch: null,
      },
      36,
    );

    expect(layout).toMatchObject({
      railWidth: 36,
      avatarLeft: 0,
      upperLanes: [],
      lowerLanes: [{ x: 18, top: 54, bottom: 0 }],
      incomingBranch: null,
    });
  });

  test('답글은 부모 lane에서 현재 avatar 앞까지 둥근 branch를 만든다', () => {
    const layout = getTodoCommentConnectionLayout(
      {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      36,
    );

    expect(layout).toMatchObject({
      railWidth: 66,
      avatarLeft: 30,
      upperLanes: [],
      incomingBranch: { left: 18, top: 0, width: 8, height: 32, radius: 8 },
    });
  });

  test('깊은 대화는 마지막 시각 lane에 모아 본문 폭을 보존한다', () => {
    const layout = getTodoCommentConnectionLayout(
      {
        visualDepth: 8,
        upperLaneDepths: [0, 3, 7],
        lowerLaneDepths: [0, 3, 7, 8],
        incomingBranch: { fromDepth: 7, toDepth: 8 },
      },
      36,
    );

    expect(layout.railWidth).toBe(156);
    expect(layout.avatarLeft).toBe(120);
    expect(layout.upperLanes.map(({ x }) => x)).toEqual([18, 108, 138]);
    expect(layout.lowerLanes.map(({ x }) => x)).toEqual([18, 108, 138]);
    expect(layout.incomingBranch).toBeNull();
  });
});
