import { weatherDevParamsSchema } from './weather-dev-params.schema';

describe('weatherDevParamsSchema', () => {
  it.each([
    { name: '값이 없으면 날씨가 없다', params: {}, devScene: undefined, devNight: '0' },
    {
      name: '날씨만 주면 낮이다',
      params: { devScene: 'HAIL' },
      devScene: 'HAIL',
      devNight: '0',
    },
    {
      name: '밤을 함께 주면 밤이다',
      params: { devScene: 'HAIL', devNight: '1' },
      devScene: 'HAIL',
      devNight: '1',
    },
    {
      name: '낯선 날씨는 없는 것으로 읽는다',
      params: { devScene: 'TORNADO' },
      devScene: undefined,
      devNight: '0',
    },
    {
      name: '낯선 밤 값은 null로 읽어 덮어쓰기를 끄게 한다',
      params: { devScene: 'HAIL', devNight: '2' },
      devScene: 'HAIL',
      devNight: null,
    },
  ])('$name', ({ params, devScene, devNight }) => {
    // When
    const parsed = weatherDevParamsSchema.parse(params);

    // Then
    expect(parsed).toEqual({ devScene, devNight });
  });
});
