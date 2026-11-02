import { WEATHER_CONDITIONS, type WeatherCondition } from '@aido/api';

import {
  WEATHER_SCENE_MAX_PRECIPITATION_ANGLE,
  type WeatherSceneInput,
  weatherSceneSchema,
  WeatherScenePolicy,
} from './weather-scene.model';

const createInput = (overrides: Partial<WeatherSceneInput> = {}): WeatherSceneInput => ({
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
  ...overrides,
});

const PRECIPITATING_CONDITIONS = [
  'DRIZZLE',
  'RAIN',
  'HEAVY_RAIN',
  'THUNDERSTORMS',
  'SLEET',
  'SNOW',
  'HEAVY_SNOW',
  'HAIL',
] as const satisfies readonly WeatherCondition[];

describe('날씨 장면 변환', () => {
  test.each(
    WEATHER_CONDITIONS.flatMap((condition) => [
      [condition, true] as const,
      [condition, false] as const,
    ]),
  )('%s 상태(낮 %s)는 스키마를 만족하는 장면이 된다', (condition, isDaylight) => {
    // Given
    const input = createInput({ condition, isDaylight, cloudCover: 50, windSpeed: 4 });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(weatherSceneSchema.safeParse(scene).success).toBe(true);
    expect(scene.isDaylight).toBe(isDaylight);
  });

  test.each([
    ['RAIN', 'rain'],
    ['SLEET', 'sleet'],
    ['SNOW', 'snow'],
    ['HAIL', 'hail'],
    ['CLEAR', 'none'],
    ['FOGGY', 'none'],
  ] as const)('%s 상태의 강수 종류는 %s이다', (condition, kind) => {
    // Given
    const input = createInput({ condition });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(scene.precipitation.kind).toBe(kind);
  });

  test('맑은 낮에는 해를, 맑은 밤에는 별을 보여 준다', () => {
    // Given
    const day = createInput({ isDaylight: true });
    const night = createInput({ isDaylight: false });
    // When
    const [dayScene, nightScene] = [day, night].map(WeatherScenePolicy.fromInput);
    // Then
    expect(dayScene).toMatchObject({ sky: 'clearDay', sun: true, stars: false });
    expect(nightScene).toMatchObject({ sky: 'clearNight', sun: false, stars: true });
  });

  test.each(PRECIPITATING_CONDITIONS)(
    '%s 상태에서는 해와 별을 숨기고 강수를 보여 준다',
    (condition) => {
      // Given
      const input = createInput({ condition, isDaylight: false, cloudCover: 0 });
      // When
      const scene = WeatherScenePolicy.fromInput(input);
      // Then
      expect(scene.sun || scene.stars).toBe(false);
      expect(scene.precipitation.kind).not.toBe('none');
      expect(scene.precipitation.density).toBeGreaterThan(0);
    },
  );

  test.each([
    ['DRIZZLE', true, 'rainDay'],
    ['RAIN', false, 'rainNight'],
    ['HEAVY_RAIN', true, 'rainDay'],
    ['THUNDERSTORMS', true, 'stormDay'],
    ['HAIL', false, 'stormNight'],
    ['CLOUDY', true, 'overcastDay'],
    ['HOT', true, 'hotDay'],
  ] as const)('%s 상태(낮 %s)는 %s 하늘을 쓴다', (condition, isDaylight, sky) => {
    // Given
    const input = createInput({ condition, isDaylight });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(scene.sky).toBe(sky);
  });

  test('폭염 낮에는 해와 함께 아지랑이를 깐다', () => {
    // Given
    const input = createInput({ condition: 'HOT' });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(scene.sun).toBe(true);
    expect(scene.fog).toBeGreaterThan(0);
  });

  test('번개는 뇌우에서만 친다', () => {
    // Given
    const conditions = WEATHER_CONDITIONS.map((condition) => createInput({ condition }));
    // When
    const withLightning = conditions
      .map(WeatherScenePolicy.fromInput)
      .flatMap((scene, index) => (scene.lightning ? [conditions[index]?.condition] : []));
    // Then
    expect(withLightning).toEqual(['THUNDERSTORMS']);
  });

  test('안개 상태는 짙은 안개, 연무 상태는 옅은 안개를 깐다', () => {
    // Given
    const foggy = createInput({ condition: 'FOGGY' });
    const hazy = createInput({ condition: 'HAZY' });
    // When
    const [fogScene, hazeScene] = [foggy, hazy].map(WeatherScenePolicy.fromInput);
    // Then
    expect(fogScene?.fog).toBeGreaterThan(hazeScene?.fog ?? 1);
    expect(hazeScene?.fog).toBeGreaterThan(0);
  });

  test('운량은 상태가 허용하는 범위 안으로 맞춘다', () => {
    // Given
    const clearWithClouds = createInput({ condition: 'CLEAR', cloudCover: 100 });
    const cloudyWithoutClouds = createInput({ condition: 'CLOUDY', cloudCover: 0 });
    const unknownCover = createInput({ condition: 'PARTLY_CLOUDY', cloudCover: Number.NaN });
    // When
    const scenes = [clearWithClouds, cloudyWithoutClouds, unknownCover].map(
      WeatherScenePolicy.fromInput,
    );
    // Then
    expect(scenes.map((scene) => scene.clouds)).toEqual([0.15, 0.85, 0.3]);
  });
});

describe('강수 강도와 밀도', () => {
  const rainDensity = (precipitationIntensity: number) =>
    WeatherScenePolicy.fromInput(createInput({ condition: 'RAIN', precipitationIntensity }))
      .precipitation.density;

  test.each([10, 500, Number.POSITIVE_INFINITY])(
    '강수 강도 %pmm/h 이상은 밀도가 1에서 멈춘다',
    (intensity) => {
      // Given / When / Then
      expect(rainDensity(intensity)).toBe(1);
    },
  );

  test('강수 강도가 클수록 밀도가 높다', () => {
    // Given
    const intensities = [2, 5, 8];
    // When
    const densities = intensities.map(rainDensity);
    // Then
    expect([...densities].sort((a, b) => a - b)).toEqual(densities);
    expect(new Set(densities).size).toBe(3);
  });

  test('비 상태는 강도 값이 없거나 잘못돼도 최소 밀도를 유지하고 1을 넘지 않는다', () => {
    // Given
    const intensities = [Number.NaN, -1, 0, 1_000_000];
    // When
    const densities = intensities.map(rainDensity);
    // Then
    expect(densities).toEqual([0.4, 0.4, 0.4, 1]);
  });

  test('맑은 날은 강수 강도 값이 있어도 내리지 않는다', () => {
    // Given
    const input = createInput({ condition: 'CLEAR', precipitationIntensity: 5 });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(scene.precipitation).toMatchObject({ kind: 'none', density: 0, angle: 0 });
  });
});

describe('바람과 강수 각도', () => {
  test.each([
    [-10, 0],
    [Number.NaN, 0],
    [0, 0],
    [7.5, WEATHER_SCENE_MAX_PRECIPITATION_ANGLE / 2],
    [15, WEATHER_SCENE_MAX_PRECIPITATION_ANGLE],
    [80, WEATHER_SCENE_MAX_PRECIPITATION_ANGLE],
  ])('비 오는 날 풍속 %pm/s의 강수 각도는 %p 라디안이다', (windSpeed, expected) => {
    // Given
    const input = createInput({ condition: 'RAIN', windSpeed });
    // When
    const { angle } = WeatherScenePolicy.fromInput(input).precipitation;
    // Then
    expect(angle).toBeCloseTo(expected);
  });

  test('강한 바람 상태는 풍속이 약해도 비스듬히 내린다', () => {
    // Given
    const input = createInput({ condition: 'HEAVY_RAIN', windSpeed: 0 });
    // When
    const scene = WeatherScenePolicy.fromInput(input);
    // Then
    expect(scene.precipitation.angle).toBeGreaterThan(0);
    expect(scene.precipitation.angle).toBeLessThanOrEqual(WEATHER_SCENE_MAX_PRECIPITATION_ANGLE);
  });
});
