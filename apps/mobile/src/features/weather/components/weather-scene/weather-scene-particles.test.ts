import {
  createParticleSeeds,
  createSeededRandom,
  getLightningIntensity,
  getParticleCount,
  PARTICLE_BUDGETS,
  PARTICLE_SEED_STRIDE,
  wrap,
} from './weather-scene-particles';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 1366, height: 1024 };

describe('날씨 장면 난수', () => {
  test('같은 시드는 기기와 실행에 관계없이 같은 수열을 만든다', () => {
    // Given
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    // When
    const sequences = [first, second].map((random) => Array.from({ length: 8 }, random));
    // Then
    expect(sequences[0]).toEqual(sequences[1]);
  });

  test('다른 시드는 다른 입자 배치를 만들고 값은 0 이상 1 미만이다', () => {
    // Given
    const count = 50;
    // When
    const [rain, snow] = [1, 2].map((seed) => createParticleSeeds(count, seed));
    // Then
    expect(rain).toHaveLength(count * PARTICLE_SEED_STRIDE);
    expect(rain).not.toEqual(snow);
    expect([...(rain ?? []), ...(snow ?? [])].every((value) => value >= 0 && value < 1)).toBe(true);
  });

  test('화면 밖으로 나간 위치는 반대편으로 감싼다', () => {
    // Given
    const length = 100;
    // When
    const wrapped = [-30, 0, 250].map((value) => wrap(value, length));
    // Then
    expect(wrapped).toEqual([70, 0, 50]);
  });
});

describe('입자 개수', () => {
  test.each([
    [Number.NaN, 0],
    [-1, 0],
    [0, 0],
    [0.5, Math.round(PARTICLE_BUDGETS.rain.full * 0.5)],
    [1, PARTICLE_BUDGETS.rain.full],
    [40, PARTICLE_BUDGETS.rain.full],
  ])('기준 화면에서 비 밀도 %p는 입자 %p개다', (density, expected) => {
    // Given
    const isLowEndDevice = false;
    // When
    const count = getParticleCount('rain', density, PHONE, isLowEndDevice);
    // Then
    expect(count).toBe(expected);
  });

  test('큰 화면은 입자를 늘리되 기기 등급별 상한을 넘지 않는다', () => {
    // Given
    const kinds = ['rain', 'snow', 'hail'] as const;
    // When
    const counts = kinds.map((kind) => ({
      kind,
      standard: getParticleCount(kind, 1, TABLET, false),
      lowEnd: getParticleCount(kind, 1, TABLET, true),
    }));
    // Then
    expect(counts).toEqual(
      kinds.map((kind) => ({
        kind,
        standard: PARTICLE_BUDGETS[kind].standardCap,
        lowEnd: PARTICLE_BUDGETS[kind].lowEndCap,
      })),
    );
  });

  test('크기를 알 수 없는 화면에는 입자를 만들지 않는다', () => {
    // Given
    const screen = { width: 0, height: 844 };
    // When
    const count = getParticleCount('snow', 1, screen, false);
    // Then
    expect(count).toBe(0);
  });
});

describe('번개', () => {
  const FRAME_SECONDS = 1 / 120;
  const DURATION_SECONDS = 600;
  const samples = Array.from(
    { length: Math.round(DURATION_SECONDS / FRAME_SECONDS) },
    (_, index) => index * FRAME_SECONDS,
  );

  const flashStarts = (times: number[]) =>
    times.filter(
      (time) =>
        getLightningIntensity(time) > 0 && getLightningIntensity(time - FRAME_SECONDS) === 0,
    );

  test('같은 시각에는 언제나 같은 밝기다', () => {
    // Given
    const time = 1234.56;
    // When
    const intensities = [getLightningIntensity(time), getLightningIntensity(time)];
    // Then
    expect(intensities[0]).toBe(intensities[1]);
  });

  test('번개는 가끔 치고 밝기는 0과 1 사이다', () => {
    // Given
    const times = samples;
    // When
    const intensities = times.map(getLightningIntensity);
    const starts = flashStarts(times);
    // Then
    expect(intensities.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(starts.length).toBeGreaterThan(20);
    expect(intensities.filter((value) => value > 0).length / intensities.length).toBeLessThan(0.1);
  });

  test('어느 1초 구간에도 섬광은 3번 미만이다', () => {
    // Given
    const starts = flashStarts(samples);
    // When
    const maxFlashesPerSecond = Math.max(
      ...starts.map(
        (start) => starts.filter((other) => other >= start && other < start + 1).length,
      ),
    );
    // Then
    expect(maxFlashesPerSecond).toBeLessThan(3);
  });
});
