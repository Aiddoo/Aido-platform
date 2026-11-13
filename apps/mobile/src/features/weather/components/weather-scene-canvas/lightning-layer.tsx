import { BlurMask, Group, Path, Rect } from '@shopify/react-native-skia';
import { useRebuiltPath } from '@src/shared/hooks/use-rebuilt-path';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import {
  getLightningIntensity,
  getLightningWindow,
  hashCycle,
  NO_LIGHTNING_WINDOW,
} from '../../utils/weather-scene-particles.view-model';

/** 시안 wxFlash의 첫 섬광 최대 불투명도 */
const MAX_FLASH_OPACITY = 0.45;
/** 줄기는 화면 폭 20~80%에서 내려와 화면 높이의 절반까지 갈라지며 뻗는다. */
const BOLT = {
  startX: [0.2, 0.8],
  reach: 0.5,
  sway: 28,
  step: [18, 40],
  maxSegments: 24,
} as const;
const BRANCH = { segments: 4, sway: [20, 40], step: [14, 30], from: [0.3, 0.7] } as const;
const BOLT_SALT = { start: 0, branch: 1, branchDirection: 2, segment: 3 } as const;
const GLOW = { color: 'rgba(190,210,255,0.9)', width: 6, blur: 8 } as const;
const CORE = { color: 'rgba(245,248,255,1)', width: 2 } as const;

type LightningLayerProps = {
  width: number;
  height: number;
  time: SharedValue<number>;
};

/** 하늘이 번쩍일 때마다 구간마다 모양이 다른 번개 줄기가 갈라지며 내리친다. */
export function LightningLayer({ width, height, time }: LightningLayerProps) {
  const intensity = useDerivedValue(() => getLightningIntensity(time.get()));
  const flashOpacity = useDerivedValue(() => intensity.get() * MAX_FLASH_OPACITY);

  // 줄기 모양은 구간 번호로만 정해져 구간이 바뀔 때만 그린다. 번개가 없는 동안 매 프레임 경로를 만들지 않는다
  const bolt = useRebuiltPath(
    () => {
      'worklet';
      return getLightningWindow(time.get());
    },
    (builder, window) => {
      'worklet';
      if (window === NO_LIGHTNING_WINDOW) {
        return;
      }
      const random = (salt: number, index: number) => {
        'worklet';
        return hashCycle(window, index, salt);
      };
      const [minStart, maxStart] = BOLT.startX;
      const [minStep, maxStep] = BOLT.step;
      let x = width * (minStart + random(BOLT_SALT.start, 0) * (maxStart - minStart));
      let y = 0;
      builder.moveTo(x, y);
      const branchAt = Math.floor(
        BOLT.maxSegments *
          (BRANCH.from[0] + random(BOLT_SALT.branch, 0) * (BRANCH.from[1] - BRANCH.from[0])),
      );
      let branchFrom = { x, y };
      for (let segment = 1; segment <= BOLT.maxSegments && y < height * BOLT.reach; segment += 1) {
        x += (random(BOLT_SALT.segment, segment * 2) * 2 - 1) * BOLT.sway;
        y += minStep + random(BOLT_SALT.segment, segment * 2 + 1) * (maxStep - minStep);
        builder.lineTo(x, y);
        if (segment === branchAt) {
          branchFrom = { x, y };
        }
      }
      const direction = random(BOLT_SALT.branchDirection, 0) < 0.5 ? -1 : 1;
      const [minSway, maxSway] = BRANCH.sway;
      const [minBranchStep, maxBranchStep] = BRANCH.step;
      builder.moveTo(branchFrom.x, branchFrom.y);
      for (let segment = 1; segment <= BRANCH.segments; segment += 1) {
        branchFrom = {
          x:
            branchFrom.x +
            direction * (minSway + random(BOLT_SALT.branch, segment) * (maxSway - minSway)),
          y:
            branchFrom.y +
            minBranchStep +
            random(BOLT_SALT.branchDirection, segment) * (maxBranchStep - minBranchStep),
        };
        builder.lineTo(branchFrom.x, branchFrom.y);
      }
    },
  );

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color="white" opacity={flashOpacity} />
      <Group opacity={intensity}>
        <Path
          path={bolt}
          style="stroke"
          strokeWidth={GLOW.width}
          strokeJoin="round"
          strokeCap="round"
          color={GLOW.color}
        >
          <BlurMask blur={GLOW.blur} style="normal" />
        </Path>
        <Path
          path={bolt}
          style="stroke"
          strokeWidth={CORE.width}
          strokeJoin="round"
          strokeCap="round"
          color={CORE.color}
        />
      </Group>
    </Group>
  );
}
