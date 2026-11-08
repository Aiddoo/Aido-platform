import { WEATHER_CONDITIONS, type WeatherCondition } from '@aido/api';
import { z } from 'zod';

import {
  WEATHER_SCENE_MAX_PRECIPITATION_ANGLE,
  getMoonIllumination,
  toWeatherScene,
  type WeatherSceneInput,
} from './weather-scene.view-model';

const unit = z.number().min(0).max(1);
const weatherSceneRangeSchema = z.object({
  precipitation: z.object({
    density: unit,
    speed: unit,
    angle: z.number().min(0).max(WEATHER_SCENE_MAX_PRECIPITATION_ANGLE),
  }),
  clouds: unit,
  fog: unit,
  wind: unit,
  moonPhase: unit,
});

const createInput = (overrides: Partial<WeatherSceneInput> = {}): WeatherSceneInput => ({
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
  moonPhase: 'FULL',
  latitude: 37.5,
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
  )('%s 상태(낮 %s)는 각 값이 범위 안에 있는 장면이 된다', (condition, isDaylight) => {
    // Given
    const input = createInput({ condition, isDaylight, cloudCover: 50, windSpeed: 4 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(weatherSceneRangeSchema.safeParse(scene).success).toBe(true);
    expect(scene.isDaylight).toBe(isDaylight);
  });

  test.each([
    ['DRIZZLE', 'drizzle'],
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
    const scene = toWeatherScene(input);

    // Then
    expect(scene.precipitation.kind).toBe(kind);
  });

  test('맑은 낮에는 렌즈 반사가 있는 해를, 맑은 밤에는 달·별·별똥별을 보여 준다', () => {
    // Given
    const day = createInput({ isDaylight: true });
    const night = createInput({ isDaylight: false });

    // When
    const [dayScene, nightScene] = [day, night].map(toWeatherScene);

    // Then
    expect(dayScene).toMatchObject({
      sky: 'clearDay',
      sun: 'bright',
      hasLensFlare: true,
      hasMoon: false,
      hasStars: false,
    });
    expect(nightScene).toMatchObject({
      sky: 'clearNight',
      sun: 'hidden',
      hasLensFlare: false,
      hasMoon: true,
      hasStars: true,
      hasShootingStars: true,
    });
  });

  test.each([
    ['CLEAR', 'calm'],
    ['MOSTLY_CLEAR', 'calm'],
    ['PARTLY_CLOUDY', 'calm'],
    ['MOSTLY_CLOUDY', 'calm'],
    ['CLOUDY', 'calm'],
    ['FOGGY', 'fogBands'],
    ['HAZY', 'haze'],
    ['WINDY', 'gusts'],
    ['DRIZZLE', 'mistyGlass'],
    ['RAIN', 'calm'],
    ['HEAVY_RAIN', 'calm'],
    ['THUNDERSTORMS', 'calm'],
    ['SLEET', 'calm'],
    ['HAIL', 'calm'],
    ['SNOW', 'calm'],
    ['HEAVY_SNOW', 'calm'],
    ['HOT', 'heat'],
    ['FRIGID', 'frost'],
  ] as const satisfies readonly (readonly [WeatherCondition, string])[])(
    '%s 상태는 %s 대기 효과를 그린다',
    (condition, atmosphere) => {
      // When
      const scene = toWeatherScene(createInput({ condition }));

      // Then
      expect(scene.atmosphere).toBe(atmosphere);
    },
  );

  test.each([
    ['CLEAR', 'bright'],
    ['HAZY', 'diffuse'],
    ['HOT', 'blazing'],
    ['FRIGID', 'bright'],
  ] as const)('%s 낮의 해는 %s 모양이다', (condition, sun) => {
    // When
    const scene = toWeatherScene(createInput({ condition }));

    // Then
    expect(scene.sun).toBe(sun);
  });

  test.each(
    WEATHER_CONDITIONS.flatMap((condition) => [
      [condition, true] as const,
      [condition, false] as const,
    ]),
  )('%s(낮 %s)는 하늘색과 해·달·별이 같은 낮밤을 따른다', (condition, isDaylight) => {
    // Given
    const input = createInput({ condition, isDaylight, cloudCover: 0 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.sky.endsWith(isDaylight ? 'Day' : 'Night')).toBe(true);
    if (isDaylight) {
      expect(scene).toMatchObject({ hasMoon: false, hasStars: false, hasShootingStars: false });
    } else {
      expect(scene.sun).toBe('hidden');
    }
  });

  test('흐린 밤은 해·달·별·서리 없이 흐린 밤하늘만 그린다', () => {
    // Given
    const input = createInput({ condition: 'CLOUDY', isDaylight: false, cloudCover: 90 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene).toMatchObject({
      sky: 'overcastNight',
      atmosphere: 'calm',
      sun: 'hidden',
      hasLensFlare: false,
      hasMoon: false,
      hasStars: false,
    });
  });

  test('렌즈 반사는 맑은 날에만 비친다', () => {
    // Given
    const inputs = WEATHER_CONDITIONS.map((condition) => createInput({ condition }));

    // When
    const flared = inputs
      .filter((input) => toWeatherScene(input).hasLensFlare)
      .map((input) => input.condition);

    // Then
    expect(flared).toEqual(['CLEAR', 'MOSTLY_CLEAR']);
  });

  test('뿌연 하늘은 구름이 많아도 흐릿한 해가 비친다', () => {
    // Given
    const input = createInput({ condition: 'HAZY', cloudCover: 100 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.sun).toBe('diffuse');
  });

  test('별똥별은 구름이 거의 없는 밤에만 지나간다', () => {
    // Given
    const clear = createInput({ condition: 'MOSTLY_CLEAR', isDaylight: false, cloudCover: 10 });
    const cloudy = createInput({ condition: 'PARTLY_CLOUDY', isDaylight: false, cloudCover: 50 });

    // When
    const [clearScene, cloudyScene] = [clear, cloudy].map(toWeatherScene);

    // Then
    expect(clearScene?.hasShootingStars).toBe(true);
    expect(cloudyScene).toMatchObject({ hasMoon: true, hasStars: true, hasShootingStars: false });
  });

  test.each(PRECIPITATING_CONDITIONS)(
    '%s 상태에서는 해와 별을 숨기고 강수를 보여 준다',
    (condition) => {
      // Given
      const input = createInput({ condition, isDaylight: false, cloudCover: 0 });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene).toMatchObject({ sun: 'hidden', hasMoon: false, hasStars: false });
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
    ['HOT', false, 'hotNight'],
    ['FRIGID', true, 'frigidDay'],
    ['FRIGID', false, 'frigidNight'],
  ] as const)('%s 상태(낮 %s)는 %s 하늘을 쓴다', (condition, isDaylight, sky) => {
    // Given
    const input = createInput({ condition, isDaylight });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.sky).toBe(sky);
  });

  test('번개는 천둥번개에서만 친다', () => {
    // Given
    const conditions = WEATHER_CONDITIONS.map((condition) => createInput({ condition }));

    // When
    const withLightning = conditions
      .map(toWeatherScene)
      .flatMap((scene, index) => (scene.hasLightning ? [conditions[index]?.condition] : []));

    // Then
    expect(withLightning).toEqual(['THUNDERSTORMS']);
  });

  test('안개 밤에는 달과 별이 가려진다', () => {
    // Given
    const input = createInput({ condition: 'FOGGY', isDaylight: false, cloudCover: 0 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene).toMatchObject({ hasMoon: false, hasStars: false });
  });

  test('운량은 상태가 허용하는 범위 안으로 맞춘다', () => {
    // Given
    const clearWithClouds = createInput({ condition: 'CLEAR', cloudCover: 100 });
    const cloudyWithoutClouds = createInput({ condition: 'CLOUDY', cloudCover: 0 });
    const unknownCover = createInput({ condition: 'PARTLY_CLOUDY', cloudCover: Number.NaN });

    // When
    const scenes = [clearWithClouds, cloudyWithoutClouds, unknownCover].map(toWeatherScene);

    // Then
    expect(scenes.map((scene) => scene.clouds)).toEqual([0.15, 0.85, 0.3]);
  });
});

describe('강수 강도와 밀도', () => {
  const rainDensity = (precipitationIntensity: number) =>
    toWeatherScene(createInput({ condition: 'RAIN', precipitationIntensity })).precipitation
      .density;

  test.each([10, 500, Number.POSITIVE_INFINITY])(
    '강수 강도 %pmm/h 이상은 밀도가 1에서 멈춘다',
    (intensity) => {
      // When
      const density = rainDensity(intensity);

      // Then
      expect(density).toBe(1);
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
    const scene = toWeatherScene(input);

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
    const { angle } = toWeatherScene(input).precipitation;

    // Then
    expect(angle).toBeCloseTo(expected);
  });

  test('강한 바람 상태는 풍속이 약해도 비스듬히 내린다', () => {
    // Given
    const input = createInput({ condition: 'HEAVY_RAIN', windSpeed: 0 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.precipitation.angle).toBeGreaterThan(0);
    expect(scene.precipitation.angle).toBeLessThanOrEqual(WEATHER_SCENE_MAX_PRECIPITATION_ANGLE);
  });
});

describe('달의 위상', () => {
  test('서버가 준 오늘의 위상을 한 바퀴 0~1 자리에 놓는다', () => {
    // Given
    const full = createInput({ isDaylight: false, moonPhase: 'FULL' });
    const firstQuarter = createInput({ isDaylight: false, moonPhase: 'FIRST_QUARTER' });

    // When
    const fullScene = toWeatherScene(full);
    const firstQuarterScene = toWeatherScene(firstQuarter);

    // Then
    expect(fullScene.moonPhase).toBe(0.5);
    expect(firstQuarterScene.moonPhase).toBe(0.25);
  });

  test('일별 예보가 없어 위상을 모르면 밤에도 달을 그리지 않는다', () => {
    // Given
    const input = createInput({ isDaylight: false, moonPhase: null });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.moon).toBe(false);
  });

  test('보름달은 다 밝고 삭은 보이지 않는다', () => {
    // When
    const [full, fresh] = [0.5, 0].map(getMoonIllumination);

    // Then
    expect(full).toBeCloseTo(1);
    expect(fresh).toBeCloseTo(0);
  });

  test('남반구 위치에서는 달을 뒤집어 그리도록 알린다', () => {
    // Given
    const input = createInput({ isDaylight: false, latitude: -33.9 });

    // When
    const scene = toWeatherScene(input);

    // Then
    expect(scene.isSouthernHemisphere).toBe(true);
  });
});
