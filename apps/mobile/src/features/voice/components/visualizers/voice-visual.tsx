import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Shader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { Box } from '@src/shared/ui';
import { range } from 'es-toolkit';
import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  cancelAnimation,
  clamp,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useUniwind } from 'uniwind';

import {
  VOICE_GRADIENT_COLORS,
  VOICE_LIGHT_ORB,
  VOICE_VISUAL,
  VOICE_VISUAL_BARS,
} from '../../constants/voice.constants';
import { useSkiaDensityScale } from '../../hooks/use-skia-density-scale';
import { useToggleableFrameCallback } from '../../hooks/use-toggleable-frame-callback';
import { addFrameTime, shouldUseLightOrb } from '../../utils/voice-frame-budget';
import { followLevel } from '../../utils/waveform.geometry';

/** SkSL 출력은 곱셈 알파다 */
const ORB_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 center;
uniform float size;
uniform float time;
uniform float level;
uniform float isDark;
uniform float3 mainColor;
uniform float3 midColor;
uniform float3 lightColor;

half4 main(float2 position) {
  float2 p = (position - center) * 2.0 / size;
  p.y = -p.y;
  float angle = atan(p.y, p.x);
  float q = length(p);
  float edge = 0.6 + 0.13 * level + 0.008 * sin(time * 0.9)
    + (0.002 + 0.008 * level) * sin(3.0 * angle + time * 1.1)
    + (0.001 + 0.005 * level) * sin(5.0 * angle - time * 1.6);
  float2 w = p * 1.5;
  float flow = sin(w.x * 1.3 + time * 0.7 + 1.6 * sin(w.y * 1.1 - time * 0.5))
    + sin(w.y * 1.5 - time * 0.6 + 1.4 * sin(w.x * 0.9 + time * 0.4 + level * 2.0));
  flow = 0.5 + 0.25 * flow;
  float3 color = mix(mainColor, midColor, flow);
  color = mix(color, lightColor, smoothstep(0.3, 1.0, flow) * 0.7);
  color += 0.16 * (1.0 - smoothstep(0.0, 0.7, length(p - float2(-0.22, 0.28))));
  float inside = 1.0 - smoothstep(edge - 0.02, edge, q);
  float halo = exp(-max(q - edge, 0.0) * mix(6.5, 5.0, isDark)) * (0.08 + 0.42 * level)
    * (1.0 - inside) * (1.0 - smoothstep(0.84, 1.0, q));
  return half4(min(color, float3(1.0)) * inside + mainColor * halo, inside + halo);
}
`);

function toRgb(color: string) {
  const [red = 0, green = 0, blue = 0] = Skia.Color(color);
  return [red, green, blue];
}

function getBarCount(width: number) {
  'worklet';
  return clamp(
    Math.floor((width / 2 - VOICE_VISUAL_BARS.startOffset - 1) / VOICE_VISUAL_BARS.step),
    0,
    VOICE_VISUAL_BARS.maxCount,
  );
}

interface VoiceVisualProps {
  level: SharedValue<number>;
  isActive: boolean;
}

export function VoiceVisual({ level, isActive }: VoiceVisualProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const { theme } = useUniwind();
  const mainColor = useResolvedColor('text-main');
  const densityScale = useSkiaDensityScale();
  const [isLightOrb, setIsLightOrb] = useState(ORB_SHADER == null);
  const width = useSharedValue(0);
  const smoothed = useSharedValue(0);
  const time = useSharedValue(0);
  const slowMs = useSharedValue(0);
  const hasFallenBack = useSharedValue(ORB_SHADER == null);
  const sinceLastBar = useSharedValue(0);
  const pendingPeak = useSharedValue(0);
  const history = useSharedValue<number[]>(range(VOICE_VISUAL_BARS.maxCount).map(() => 0));
  const bars = useSharedValue<number[]>(
    range(VOICE_VISUAL_BARS.maxCount).map((index) =>
      isReducedMotion
        ? VOICE_VISUAL_BARS.reducedMotionLevel * (1 - index / VOICE_VISUAL_BARS.maxCount)
        : 0,
    ),
  );
  const isAnimationActive = useIsAnimationActive();
  const isMoving = isActive && isAnimationActive;

  useToggleableFrameCallback(
    (frame) => {
      'worklet';
      const frameMs = frame.timeSincePreviousFrame ?? 0;
      const elapsed = Math.min(VOICE_VISUAL.maxFrameMs, frameMs);
      const currentLevel = level.get();
      smoothed.set(followLevel(smoothed.get(), currentLevel, elapsed, VOICE_VISUAL));
      time.set(time.get() + elapsed / SECOND_MS);
      pendingPeak.set(Math.max(pendingPeak.get(), currentLevel));

      const barElapsed = sinceLastBar.get() + elapsed;
      const isBarDue = barElapsed >= VOICE_VISUAL_BARS.intervalMs;
      sinceLastBar.set(isBarDue ? 0 : barElapsed);
      if (isBarDue) {
        const peak = pendingPeak.get();
        pendingPeak.set(0);
        history.modify((values) => {
          'worklet';
          for (let index = values.length - 1; index > 0; index -= 1) {
            values[index] = values[index - 1] ?? 0;
          }
          values[0] = peak;
          return values;
        }, false);
      }
      const source = history.get();
      const followRate = 1 - Math.exp(-elapsed / VOICE_VISUAL_BARS.followMs);
      bars.modify((values) => {
        'worklet';
        for (let index = 0; index < values.length; index += 1) {
          const value = values[index] ?? 0;
          values[index] = value + ((source[index] ?? 0) - value) * followRate;
        }
        return values;
      });

      if (!hasFallenBack.get()) {
        const nextSlowMs = addFrameTime(slowMs.get(), frameMs);
        slowMs.set(nextSlowMs);
        if (shouldUseLightOrb(nextSlowMs)) {
          hasFallenBack.set(true);
          scheduleOnRN(setIsLightOrb, true);
        }
      }
    },
    { isActive: isMoving },
  );

  useEffect(() => {
    if (!isMoving) {
      smoothed.set(withTiming(0, { duration: VOICE_VISUAL.settleMs }));
    }
    return () => cancelAnimation(smoothed);
  }, [isMoving, smoothed]);

  const centerX = useDerivedValue(() => width.get() / 2);
  const orbLeft = useDerivedValue(() => centerX.get() - VOICE_VISUAL.orbSize / 2);
  const center = useDerivedValue(() => vec(centerX.get(), VOICE_VISUAL.height / 2));
  const midColor = toRgb(VOICE_GRADIENT_COLORS.orbCoral);
  const lightColor = toRgb(VOICE_GRADIENT_COLORS.orbPeach);
  const mainRgb = toRgb(mainColor);
  const darkFactor = theme === 'dark' ? 1 : 0;
  const uniforms = useDerivedValue(() => ({
    center: [centerX.get(), VOICE_VISUAL.height / 2],
    size: VOICE_VISUAL.orbSize,
    time: time.get(),
    level: smoothed.get(),
    isDark: darkFactor,
    mainColor: mainRgb,
    midColor,
    lightColor,
  }));
  const lightOrbRadius = useDerivedValue(
    () => VOICE_LIGHT_ORB.radius * (1 + VOICE_LIGHT_ORB.growRatio * smoothed.get()),
  );
  const lightOrbHighlight = useDerivedValue(() =>
    vec(
      centerX.get() - lightOrbRadius.get() * VOICE_LIGHT_ORB.highlightOffsetX,
      VOICE_VISUAL.height / 2 - lightOrbRadius.get() * VOICE_LIGHT_ORB.highlightOffsetY,
    ),
  );
  // 프레임마다 생기는 네이티브 객체를 경로 하나로 줄이려고 막대를 도형 대신 선으로 그린다
  const barPath = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    const values = bars.get();
    const count = getBarCount(width.get());
    const middleX = centerX.get();
    const middleY = VOICE_VISUAL.height / 2;
    const { minHeight, step, startOffset, heightMargin, falloff } = VOICE_VISUAL_BARS;
    for (let index = 0; index < count; index += 1) {
      const fade = 1 - (falloff * index) / count;
      const halfHeight =
        (minHeight + (values[index] ?? 0) * (VOICE_VISUAL.height - heightMargin) * fade) / 2;
      const distance = startOffset + index * step;
      target
        .moveTo(middleX - distance, middleY - halfHeight)
        .lineTo(middleX - distance, middleY + halfHeight)
        .moveTo(middleX + distance, middleY - halfHeight)
        .lineTo(middleX + distance, middleY + halfHeight);
    }
    return target.build();
  });
  const barsStart = useDerivedValue(() => vec(0, 0));
  const edgeColor = Skia.Color(mainColor).map((channel, index) =>
    index === 3 ? channel * VOICE_VISUAL_BARS.edgeOpacity : channel,
  );
  const barsEnd = useDerivedValue(() => vec(width.get(), 0));

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    width.set(nativeEvent.layout.width);
  };

  return (
    <Box
      pointerEvents="none"
      className="self-stretch"
      style={{ height: VOICE_VISUAL.height }}
      onLayout={handleLayout}
    >
      <Canvas style={{ flex: 1 }}>
        <Group transform={[{ scale: densityScale }]}>
          <Path
            path={barPath}
            style="stroke"
            strokeCap="round"
            strokeWidth={VOICE_VISUAL_BARS.width}
          >
            <LinearGradient
              start={barsStart}
              end={barsEnd}
              colors={[edgeColor, mainColor, edgeColor]}
            />
          </Path>
          {isLightOrb || isReducedMotion || ORB_SHADER == null ? (
            <Circle c={center} r={lightOrbRadius}>
              <RadialGradient
                c={lightOrbHighlight}
                r={VOICE_LIGHT_ORB.radius * VOICE_LIGHT_ORB.highlightRadiusRatio}
                colors={[VOICE_GRADIENT_COLORS.orbPeach, VOICE_GRADIENT_COLORS.orbCoral, mainColor]}
                positions={VOICE_LIGHT_ORB.gradientStops}
              />
            </Circle>
          ) : (
            <Rect
              x={orbLeft}
              y={(VOICE_VISUAL.height - VOICE_VISUAL.orbSize) / 2}
              width={VOICE_VISUAL.orbSize}
              height={VOICE_VISUAL.orbSize}
            >
              <Shader source={ORB_SHADER} uniforms={uniforms} />
            </Rect>
          )}
        </Group>
      </Canvas>
    </Box>
  );
}
