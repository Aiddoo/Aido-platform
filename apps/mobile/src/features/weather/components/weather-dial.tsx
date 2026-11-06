import { useTranslation } from '@src/shared/i18n';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { COMPASS_SHORT_LABEL_KEYS } from '../constants/weather-labels';
import { useOnSkyColor } from '../hooks/use-on-sky-color';
import {
  type CompassDial,
  type DialTicks,
  PRESSURE_GAUGE_LABELS,
  type PressureGauge,
} from '../utils/weather-dial.geometry';

const DIAL_FONT = { regular: 'WantedSans-Medium', label: 'WantedSans-SemiBold' } as const;
const DIAL_VIEWBOX = '0 0 120 120';

function DialTicksPaths({ minorTicks, majorTicks }: DialTicks) {
  const minorColor = useOnSkyColor('text-on-sky/32');
  const majorColor = useOnSkyColor('text-on-sky/85');
  return (
    <>
      <Path
        d={minorTicks}
        stroke={minorColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={majorTicks}
        stroke={majorColor}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function DialLabel({ x, y, children }: { x: number; y: number; children: string }) {
  const color = useOnSkyColor('text-on-sky/[0.62]');
  return (
    <SvgText
      x={x}
      y={y}
      textAnchor="middle"
      alignmentBaseline="central"
      fill={color}
      fontFamily={DIAL_FONT.label}
      fontSize={10}
    >
      {children}
    </SvgText>
  );
}

function DialCenter({ value, unit }: { value: string; unit: string }) {
  const valueColor = useOnSkyColor('text-on-sky');
  const unitColor = useOnSkyColor('text-on-sky/70');
  return (
    <>
      <SvgText
        x={60}
        y={56}
        textAnchor="middle"
        alignmentBaseline="central"
        fill={valueColor}
        fontFamily={DIAL_FONT.regular}
        fontSize={22}
        letterSpacing={-0.6}
      >
        {value}
      </SvgText>
      <SvgText
        x={60}
        y={74}
        textAnchor="middle"
        alignmentBaseline="central"
        fill={unitColor}
        fontFamily={DIAL_FONT.label}
        fontSize={10}
      >
        {unit}
      </SvgText>
    </>
  );
}

interface WeatherCompassProps {
  size: number;
  dial: CompassDial;
  value: string;
  unit: string;
}

/** 풍향 나침반. 꼬리는 바람이 불어오는 쪽, 화살촉은 불어 가는 쪽이다. */
export function WeatherCompass({ size, dial, value, unit }: WeatherCompassProps) {
  const { t } = useTranslation('weather');
  const needleColor = useOnSkyColor('text-on-sky');

  return (
    <Svg width={size} height={size} viewBox={DIAL_VIEWBOX} accessible={false}>
      <DialTicksPaths {...dial} />
      {dial.cardinals.map(({ direction, position }) => (
        <DialLabel key={direction} x={position.x} y={position.y}>
          {t(COMPASS_SHORT_LABEL_KEYS[direction])}
        </DialLabel>
      ))}
      {dial.needle != null && (
        <>
          <Path
            d={dial.needle.stroke}
            stroke={needleColor}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path d={dial.needle.head} fill={needleColor} />
          <Circle cx={dial.needle.tail.x} cy={dial.needle.tail.y} r={3.2} fill={needleColor} />
        </>
      )}
      <DialCenter value={value} unit={unit} />
    </Svg>
  );
}

interface WeatherPressureGaugeProps {
  size: number;
  gauge: PressureGauge;
  value: string;
  unit: string;
  lowLabel: string;
  highLabel: string;
}

/** 아래가 트인 기압 눈금판 */
export function WeatherPressureGauge({
  size,
  gauge,
  value,
  unit,
  lowLabel,
  highLabel,
}: WeatherPressureGaugeProps) {
  const needleColor = useOnSkyColor('text-on-sky');

  return (
    <Svg width={size} height={size} viewBox={DIAL_VIEWBOX} accessible={false}>
      <DialTicksPaths {...gauge} />
      <DialLabel {...PRESSURE_GAUGE_LABELS.low}>{lowLabel}</DialLabel>
      <DialLabel {...PRESSURE_GAUGE_LABELS.high}>{highLabel}</DialLabel>
      <Path
        d={gauge.needle}
        stroke={needleColor}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <Path d={gauge.head} fill={needleColor} />
      <DialCenter value={value} unit={unit} />
    </Svg>
  );
}
