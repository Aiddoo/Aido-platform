import { createContext, useContext } from 'react';

export const TIME_PALETTES = {
  dawn: {
    bg: '#1B1464',
    gradient: ['#1B1464', '#7B5EA7', '#E8A87C'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',

    glass: 'rgba(20,0,50,0.20)',
    glassCard: 'rgba(20,0,50,0.28)',
    glassStrong: 'rgba(20,0,50,0.35)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(20,0,50,0.25)',
    accent: '#A0D8FF',
  },
  day: {
    bg: '#1565C0',
    gradient: ['#1565C0', '#1E88E5', '#64B5F6'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',

    glass: 'rgba(0,20,60,0.18)',
    glassCard: 'rgba(0,20,60,0.26)',
    glassStrong: 'rgba(0,20,60,0.32)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(0,20,60,0.22)',
    accent: '#FFFFFF',
  },
  dusk: {
    bg: '#281740',
    gradient: ['#281740', '#8B4A6B', '#CA6668'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.85)',
    icon: '#FFFFFF',

    glass: 'rgba(15,5,30,0.22)',
    glassCard: 'rgba(15,5,30,0.30)',
    glassStrong: 'rgba(15,5,30,0.36)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(15,5,30,0.25)',
    accent: '#A0D8FF',
  },
  night: {
    bg: '#080C1A',
    gradient: ['#080C1A', '#101D3A', '#1A3355'] as const,
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.75)',
    icon: '#FFFFFF',

    glass: 'rgba(140,170,220,0.10)',
    glassCard: 'rgba(140,170,220,0.18)',
    glassStrong: 'rgba(140,170,220,0.24)',
    glassBorder: 'rgba(248,248,248,0.20)',
    badge: 'rgba(140,170,220,0.20)',
    accent: '#7DB4F5',
  },
} as const;

export type TimeOfDay = keyof typeof TIME_PALETTES;
export type TimePalette = (typeof TIME_PALETTES)[TimeOfDay];

export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 6 && h < 9) return 'dawn';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export const TimePaletteContext = createContext<TimePalette>(TIME_PALETTES.night);

export function useTimePalette(): TimePalette {
  return useContext(TimePaletteContext);
}
