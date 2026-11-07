import { range } from 'es-toolkit';

import {
  createParticleSeeds,
  createSeededRandom,
  createStarField,
  getAmbientCount,
  getBouncePhase,
  getCelestialCenter,
  getCloudCountPerLayer,
  getGustTravel,
  getLightningIntensity,
  getParticleCount,
  MAX_STARS,
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
    const sequences = [first, second].map((random) => range(8).map(() => random()));

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
  const samples = range(Math.round(DURATION_SECONDS / FRAME_SECONDS)).map(
    (index) => index * FRAME_SECONDS,
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

describe('별 배치', () => {
  test('같은 화면과 시드는 언제나 같은 별자리를 만든다', () => {
    // Given
    const seed = 7;

    // When
    const [first, second] = [0, 1].map(() => createStarField(PHONE.width, PHONE.height, seed));

    // Then
    expect(first).toEqual(second);
    expect(first?.length).toBeGreaterThan(0);
  });

  test('별은 하늘 위쪽에 몰리고 지평선 가까이는 드물다', () => {
    // Given
    const stars = createStarField(PHONE.width, PHONE.height, 7);
    const fieldHeight = PHONE.height * 0.6;

    // When
    const upper = stars.filter((star) => star.y < fieldHeight / 2).length;
    const lower = stars.filter((star) => star.y >= fieldHeight / 2).length;

    // Then
    expect(upper).toBeGreaterThan(lower);
    expect(stars.every((star) => star.y < fieldHeight && star.x < PHONE.width)).toBe(true);
  });

  test('큰 화면에서도 별 개수는 상한을 넘지 않고 크기를 모르면 별이 없다', () => {
    // Given
    const screens = [TABLET, { width: 0, height: 0 }];

    // When
    const counts = screens.map((screen) => createStarField(screen.width, screen.height, 7).length);

    // Then
    expect(counts).toEqual([MAX_STARS, 0]);
  });
});

describe('구름 개수', () => {
  test.each([
    [Number.NaN, 0],
    [0, 0],
    [0.04, 0],
    [0.05, 1],
    [0.5, 2],
    [1, 4],
    [3, 4],
  ])('운량 %p에는 깊이 층마다 구름 덩이 %p개를 띄운다', (amount, expected) => {
    // When
    const count = getCloudCountPerLayer(amount);

    // Then
    expect(count).toBe(expected);
  });
});

describe('대기 효과 입자 개수', () => {
  test('넓은 화면은 넓이만큼 늘려 밀도를 유지하되 저사양 기기 상한을 넘지 않는다', () => {
    // Given
    const kind = 'spindrift';

    // When
    const phone = getAmbientCount(kind, PHONE, false);
    const tablet = getAmbientCount(kind, TABLET, false);
    const lowEndTablet = getAmbientCount(kind, TABLET, true);

    // Then
    expect(phone).toBe(PARTICLE_BUDGETS.spindrift.full);
    expect(tablet).toBeGreaterThan(phone);
    expect(tablet).toBeLessThanOrEqual(PARTICLE_BUDGETS.spindrift.standardCap);
    expect(lowEndTablet).toBe(PARTICLE_BUDGETS.spindrift.lowEndCap);
  });
});

describe('돌풍', () => {
  test('돌풍이 약해져도 바람에 실린 거리는 뒤로 가지 않는다', () => {
    // Given
    const times = range(600).map((index) => index * 0.05);

    // When
    const travels = times.map(getGustTravel);

    // Then
    expect(
      travels.every((travel, index) => index === 0 || travel > (travels[index - 1] ?? 0)),
    ).toBe(true);
  });
});

describe('튀는 얼음 알', () => {
  const BOUNCES = [
    { velocity: 280, gravity: 1400 },
    { velocity: 70, gravity: 1400 },
  ];

  test.each([
    [0.5, 'falling'],
    [1.1, 'bouncing'],
    [1.45, 'bouncing'],
    [2, 'resting'],
  ] as const)('바닥까지 1초 걸리는 알은 %p초에 %s 단계다', (elapsed, phase) => {
    // When
    const result = getBouncePhase(elapsed, 1, BOUNCES);

    // Then
    expect(result.phase).toBe(phase);
  });

  test('두 번 튀고 나면 더 튀지 않는다', () => {
    // Given
    const firstLanding = 1 + (2 * 280) / 1400;

    // When
    const first = getBouncePhase(1.1, 1, BOUNCES);
    const second = getBouncePhase(firstLanding + 0.01, 1, BOUNCES);

    // Then
    expect(first).toMatchObject({ phase: 'bouncing', bounce: 0 });
    expect(second).toMatchObject({ phase: 'bouncing', bounce: 1 });
  });
});

describe('해·달 자리', () => {
  test('헤더가 낮은 화면에서는 화면 오른쪽 위 고정 비율 자리에 둔다', () => {
    // Given
    const contentTop = 56;

    // When
    const center = getCelestialCenter(PHONE, { contentTop, heroLeft: 0, heroWidth: PHONE.width });

    // Then
    expect(center.x).toBeCloseTo(PHONE.width * 0.9);
    expect(center.y).toBeCloseTo(PHONE.height * 0.118);
  });

  test('헤더가 높으면 헤더 버튼에 가리지 않게 그 아래로 내린다', () => {
    // Given
    const contentTop = 120;

    // When
    const center = getCelestialCenter(PHONE, { contentTop, heroLeft: 0, heroWidth: PHONE.width });

    // Then
    expect(center.y).toBeGreaterThan(contentTop + PHONE.width * 0.058);
  });

  test('넓은 화면에서는 지명·기온이 있는 왼쪽 단 안에 둔다', () => {
    // Given
    const heroWidth = 400;

    // When
    const center = getCelestialCenter(TABLET, { contentTop: 56, heroLeft: 0, heroWidth });

    // Then
    expect(center.x).toBeLessThan(heroWidth);
  });

  test('옆 레일이 있는 화면에서는 레일을 뺀 내용 영역 안에 둔다', () => {
    // Given
    const rail = { left: 0, width: PHONE.width - 64 };

    // When
    const center = getCelestialCenter(PHONE, {
      contentTop: 0,
      heroLeft: rail.left,
      heroWidth: rail.width,
    });

    // Then
    expect(center.x).toBeLessThan(rail.width);
  });
});
