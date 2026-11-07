import type { WeatherSceneSky } from '../utils/weather-scene.view-model';

type SkyStops = readonly [top: string, upper: string, lower: string, bottom: string];

type ScenePalette = {
  /** 장면별 배경 그라데이션. 라이트·다크 테마마다 다르고, 다크 테마에서도 낮은 밤보다 밝은 하늘색이다. */
  sky: { light: SkyStops; dark: SkyStops };
  cloud: string;
  fog: string;
  /** 카드·눈금 링을 하늘과 같은 색조로 물들이는 RGB */
  tint: string;
};

export const WEATHER_SCENE_SKY_POSITIONS = [0, 0.34, 0.68, 1];

export const WEATHER_SCENE_PALETTES = {
  clearDay: {
    sky: {
      light: ['#2C78D2', '#4A95E4', '#79B4EE', '#A6CFF4'],
      dark: ['#1A52A6', '#2A69BD', '#3B7FCC', '#6EA4DB'],
    },
    cloud: '255,255,255',
    fog: '226,236,248',
    tint: '18,66,134',
  },
  clearNight: {
    sky: {
      light: ['#070B18', '#0F1C38', '#18305A', '#22406C'],
      dark: ['#05070F', '#091021', '#0E1A31', '#13223F'],
    },
    cloud: '120,134,168',
    fog: '74,86,112',
    tint: '8,14,34',
  },
  cloudyDay: {
    sky: {
      light: ['#3B72B5', '#5990CC', '#86B2DE', '#B0CEEB'],
      dark: ['#24508A', '#3466A0', '#4A7DB3', '#7499C4'],
    },
    cloud: '255,255,255',
    fog: '220,228,238',
    tint: '27,62,113',
  },
  cloudyNight: {
    sky: {
      light: ['#0D1320', '#16223A', '#203455', '#2A4265'],
      dark: ['#0C101A', '#121A2B', '#19253B', '#202E48'],
    },
    cloud: '120,132,158',
    fog: '72,82,104',
    tint: '10,16,34',
  },
  overcastDay: {
    sky: {
      light: ['#56677F', '#75879F', '#9DADC1', '#C2CDDB'],
      dark: ['#2E3A4C', '#3B4859', '#4B5869', '#5E6B7C'],
    },
    cloud: '236,240,246',
    fog: '206,214,224',
    tint: '44,56,74',
  },
  overcastNight: {
    sky: {
      light: ['#19212E', '#242E3D', '#2E3A4C', '#384559'],
      dark: ['#121720', '#19202B', '#202935', '#27303E'],
    },
    cloud: '96,106,124',
    fog: '64,72,86',
    tint: '14,18,26',
  },
  rainDay: {
    sky: {
      light: ['#26364F', '#3A506F', '#58779B', '#86A2C0'],
      dark: ['#1E2B40', '#2A3A52', '#3A4B64', '#4E5F77'],
    },
    cloud: '200,212,228',
    fog: '186,198,214',
    tint: '16,28,50',
  },
  rainNight: {
    sky: {
      light: ['#10172A', '#182339', '#213049', '#2A3C57'],
      dark: ['#0B101D', '#111828', '#172233', '#1D2A3D'],
    },
    cloud: '82,94,116',
    fog: '62,72,90',
    tint: '10,16,30',
  },
  stormDay: {
    sky: {
      light: ['#222842', '#383D63', '#585C87', '#8689AC'],
      dark: ['#1B1F33', '#272B45', '#353A57', '#454A69'],
    },
    cloud: '170,172,204',
    fog: '150,152,184',
    tint: '18,18,42',
  },
  stormNight: {
    sky: {
      light: ['#0B0E1E', '#13172D', '#1D213C', '#26294A'],
      dark: ['#080A15', '#0E101F', '#14172A', '#1B1D34'],
    },
    cloud: '70,72,100',
    fog: '56,58,82',
    tint: '6,8,16',
  },
  snowDay: {
    sky: {
      light: ['#485870', '#687A93', '#94A5BA', '#C3CFDC'],
      dark: ['#2A3A50', '#3A4B63', '#4F617A', '#6A7C93'],
    },
    cloud: '236,242,248',
    fog: '228,236,244',
    tint: '36,48,66',
  },
  snowNight: {
    sky: {
      light: ['#141B26', '#1E2A3A', '#29394D', '#34465E'],
      dark: ['#0E131B', '#151D28', '#1D2836', '#243142'],
    },
    cloud: '120,132,158',
    fog: '96,108,132',
    tint: '12,18,32',
  },
  fogDay: {
    sky: {
      light: ['#6E7884', '#8B949E', '#AAB1B8', '#C6CBD0'],
      dark: ['#3A4048', '#4A5059', '#5B626B', '#6E747D'],
    },
    cloud: '214,219,224',
    fog: '214,220,226',
    tint: '50,56,64',
  },
  fogNight: {
    sky: {
      light: ['#1A1E24', '#262B32', '#333941', '#3F454E'],
      dark: ['#121519', '#1B1E23', '#24282E', '#2C3037'],
    },
    cloud: '84,92,104',
    fog: '84,92,104',
    tint: '14,16,22',
  },
  hazeDay: {
    sky: {
      light: ['#7A7466', '#958D7C', '#B3A88F', '#CFC2A6'],
      dark: ['#4A4234', '#5C5241', '#6E6350', '#827561'],
    },
    cloud: '232,224,206',
    fog: '236,214,176',
    tint: '64,54,36',
  },
  hazeNight: {
    sky: {
      light: ['#1F1B14', '#2C271E', '#3A3428', '#463F31'],
      dark: ['#16130E', '#1F1B15', '#29241C', '#312C22'],
    },
    cloud: '98,92,80',
    fog: '92,84,70',
    tint: '18,16,12',
  },
  hotDay: {
    sky: {
      light: ['#BF5229', '#DD773A', '#F0A463', '#F7CC94'],
      dark: ['#6E2A12', '#8C3B1A', '#A85228', '#C06C38'],
    },
    cloud: '255,236,210',
    fog: '255,220,170',
    tint: '110,36,10',
  },
  hotNight: {
    sky: {
      light: ['#1C1013', '#2C1A1A', '#3E2721', '#4C3226'],
      dark: ['#130B0D', '#1F1313', '#2B1B17', '#37231B'],
    },
    cloud: '128,104,96',
    fog: '120,86,64',
    tint: '40,18,12',
  },
  frigidDay: {
    sky: {
      light: ['#3A80D2', '#62A2E4', '#9CC6F0', '#CFE6F8'],
      dark: ['#1F5CAE', '#3577C6', '#5A96D6', '#93BEE6'],
    },
    cloud: '244,250,255',
    fog: '225,240,255',
    tint: '22,72,138',
  },
  frigidNight: {
    sky: {
      light: ['#050B1C', '#0B1730', '#122442', '#1A2F52'],
      dark: ['#03070F', '#071021', '#0C1932', '#11223F'],
    },
    cloud: '126,146,184',
    fog: '96,124,168',
    tint: '6,14,36',
  },
} as const satisfies Record<WeatherSceneSky, ScenePalette>;
