import { VStack } from '@src/shared/ui';
import { View } from 'react-native';

/**
 * 아바타 열의 폭(36px). 스레드 선이 지나는 자리라 모든 행이 같은 값을 쓴다.
 * 글자를 키워도 선의 자리는 그대로여서 들여쓰기가 흔들리지 않는다.
 */
export const THREAD_COLUMN_WIDTH = 'w-9';

/** 아바타 지름. 선은 이 뒤로 숨어 들어가며 시작하거나 끝난다. */
export const THREAD_AVATAR_SIZE = 36;

/** 선이 지나는 축 — 아바타 가운데. 열 왼쪽에서 재는 값이다. */
const LINE_AXIS_PX = 17;

const LINE = 'border-gray-4 border-l-[1.5px]';

/** 흐름 안에서 그리는 선의 축. 담는 열에 가운데 정렬을 걸면 이 축이 밀린다. */
const LINE_AXIS = 'ml-[17px]';

/**
 * 절대 위치로 그리는 선. 아바타 열의 왼쪽 끝에서 시작하는 relative 컨테이너 안에 둔다.
 * 위아래로 얼마나 뻗을지는 놓는 쪽이 정한다.
 */
export const THREAD_LINE = `absolute left-[${LINE_AXIS_PX}px] w-[1.5px] bg-gray-4`;

/**
 * 이 아바타에서 시작해 바로 아래 블록까지 내려가는 선.
 * 아바타 가운데에서 출발하므로 아바타가 시작점을 가려, 아바타 아래에서 자연스럽게 흘러나온다.
 */
export function ThreadConnectorDown() {
  return (
    <View
      pointerEvents="none"
      style={{ top: THREAD_AVATAR_SIZE / 2, bottom: 0 }}
      className={THREAD_LINE}
    />
  );
}

/** 위에서 내려온 선이 이 줄의 아바타에서 맺힌다. 아바타가 끝점을 가려 잘린 자국이 남지 않는다. */
export function ThreadConnectorUp({ endsAt }: { endsAt: number }) {
  return <View pointerEvents="none" style={{ top: 0, height: endsAt }} className={THREAD_LINE} />;
}

interface ThreadBranchProps {
  /** 가로 팔이 뻗는 높이 — 붙을 대상(아바타·글자)의 중심에 맞춘다. */
  turnAt: number;
  /** 가로 팔이 닿을 지점 — 열(36px) 왼쪽 기준. 기본값은 바로 옆 아바타의 왼쪽 끝이다. */
  reachesTo?: number;
  /** 아래에 형제가 더 있는지. 있으면 선이 계속 내려가고, 없으면 여기서 휘어 맺힌다. */
  continuesBelow: boolean;
}

/** 열(36px)과 그 다음 간격(10px)을 건너 바로 옆 요소의 왼쪽 끝. */
export const ELBOW_REACHES_AVATAR = 29;

/**
 * 답글 하나로 뻗는 가지. 형제마다 팔이 하나씩 붙어 어느 줄도 끊겨 보이지 않는다.
 * 곡선은 마지막 줄에만 준다 — 중간에서 휘면 갈고리가 여러 개 달린 것처럼 보인다.
 */
export function ThreadBranch({
  turnAt,
  reachesTo = ELBOW_REACHES_AVATAR,
  continuesBelow,
}: ThreadBranchProps) {
  return (
    <VStack className={THREAD_COLUMN_WIDTH}>
      <View
        style={{ height: turnAt, width: reachesTo }}
        className={`${continuesBelow ? '' : 'rounded-bl-[12px]'} border-b-[1.5px] ${LINE_AXIS} ${LINE}`}
      />
      {continuesBelow && <View className={`flex-1 ${LINE_AXIS} ${LINE}`} />}
    </VStack>
  );
}
