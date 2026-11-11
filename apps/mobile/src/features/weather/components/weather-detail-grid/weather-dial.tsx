import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useTranslation } from '@src/shared/i18n';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import {
  type CompassDial,
  DIAL_CENTER,
  DIAL_VIEWBOX_SIZE,
  type DialTicks,
  PRESSURE_GAUGE_LABELS,
  type PressureGauge,
} from '../../utils/weather-dial.geometry';
import { getCompassShortLabelKey } from '../../utils/weather-labels.view-model';

const DIAL_FONT = { regular: 'WantedSans-Medium', label: 'WantedSans-SemiBold' } as const;
const DIAL_VIEWBOX = `0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}`;
/** 가운데 값은 중심보다 조금 위, 단위는 조금 아래에 둔다. */
const VALUE_OFFSET_Y = -4;
const UNIT_OFFSET_Y = 14;

function DialTicksPaths({ minorTicks, majorTicks }: DialTicks) {
  const minorColor = useResolvedColor('text-on-sky/32');
  const majorColor = useResolvedColor('text-on-sky/85');
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
  const color = useResolvedColor('text-on-sky/[0.62]');
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
  const valueColor = useResolvedColor('text-on-sky');
  const unitColor = useResolvedColor('text-on-sky/70');
  return (
    <>
      <SvgText
        x={DIAL_CENTER}
        y={DIAL_CENTER + VALUE_OFFSET_Y}
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
        x={DIAL_CENTER}
        y={DIAL_CENTER + UNIT_OFFSET_Y}
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
  const needleColor = useResolvedColor('text-on-sky');

  return (
    <Svg width={size} height={size} viewBox={DIAL_VIEWBOX} accessible={false}>
      <DialTicksPaths {...dial} />
      {dial.cardinals.map(({ direction, position }) => (
        <DialLabel key={direction} x={position.x} y={position.y}>
          {t(getCompassShortLabelKey(direction))}
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
  const needleColor = useResolvedColor('text-on-sky');

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
