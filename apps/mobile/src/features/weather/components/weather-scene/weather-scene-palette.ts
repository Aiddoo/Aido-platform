import type { WeatherSceneSky } from '../../domains/weather-scene.model';

type ScenePalette = {
  sky: readonly [top: string, middle: string, bottom: string];
  cloud: string;
  fog: string;
};

export const WEATHER_SCENE_PALETTES = {
  clearDay: {
    sky: ['#2463C7', '#3F86DB', '#7DB5EC'],
    cloud: '255,255,255',
    fog: '226,236,248',
  },
  clearNight: {
    sky: ['#040917', '#0B1733', '#1A2C52'],
    cloud: '120,134,168',
    fog: '74,86,112',
  },
  cloudyDay: {
    sky: ['#3F6A9E', '#5F86B4', '#93AFCF'],
    cloud: '246,249,252',
    fog: '220,228,238',
  },
  cloudyNight: {
    sky: ['#0A1124', '#17223B', '#2A3853'],
    cloud: '112,124,150',
    fog: '72,82,104',
  },
  overcastDay: {
    sky: ['#56677A', '#728194', '#97A4B3'],
    cloud: '206,214,224',
    fog: '196,204,214',
  },
  overcastNight: {
    sky: ['#10151D', '#1B222D', '#2B3440'],
    cloud: '86,96,112',
    fog: '64,72,86',
  },
  stormDay: {
    sky: ['#29323E', '#3D4855', '#5C6773'],
    cloud: '128,138,152',
    fog: '150,160,172',
  },
  stormNight: {
    sky: ['#06080D', '#10151F', '#1E2531'],
    cloud: '58,66,80',
    fog: '52,60,72',
  },
  snowDay: {
    sky: ['#5F7593', '#8296B0', '#AABACD'],
    cloud: '236,242,248',
    fog: '228,236,244',
  },
  snowNight: {
    sky: ['#121929', '#202B43', '#35425D'],
    cloud: '120,132,158',
    fog: '96,108,132',
  },
  fogDay: {
    sky: ['#6E7884', '#8B949E', '#AAB1B8'],
    cloud: '214,219,224',
    fog: '208,214,220',
  },
  fogNight: {
    sky: ['#13171E', '#21262F', '#333943'],
    cloud: '84,92,104',
    fog: '78,86,98',
  },
  hazeDay: {
    sky: ['#6F6A5E', '#91897A', '#B8AC93'],
    cloud: '232,224,206',
    fog: '222,208,176',
  },
  hazeNight: {
    sky: ['#17150F', '#26231C', '#3A352B'],
    cloud: '98,92,80',
    fog: '92,84,70',
  },
  hotDay: {
    sky: ['#1E5DBF', '#4C8AD6', '#E2A86E'],
    cloud: '255,248,236',
    fog: '250,226,190',
  },
} as const satisfies Record<WeatherSceneSky, ScenePalette>;
