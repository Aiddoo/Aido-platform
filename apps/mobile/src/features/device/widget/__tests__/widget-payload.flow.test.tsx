/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import { i18n } from '@src/shared/i18n';
import { act } from '@testing-library/react-native';

import { AIDO_WIDGETS } from '../components/widgets';
import {
  ALL_DONE_TODAY_WITHOUT_TOMORROW,
  setupWidgetPayloadClock,
  syncWidget,
} from './widget-payload.test-utils';

// 홈 화면 위젯이 받는 값은 출시 앱과 위젯 사이의 계약이다. 기대값을 고치면 이미 놓인 위젯의 모양이 바뀐다
// iOS 위젯은 AidoTodayList 하나다
function writtenTimelines() {
  return AIDO_WIDGETS.flatMap(({ widget }) => jest.mocked(widget.updateTimeline).mock.calls);
}

const KO_TODAY_WEEK = [
  {
    date: '2026-07-12',
    weekdayLabel: '일',
    dayLabel: '12',
    isComplete: false,
    hasTodos: true,
    isToday: true,
    destination: 'aido://feed?date=today',
  },
  {
    date: '2026-07-13',
    weekdayLabel: '월',
    dayLabel: '13',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-13',
  },
  {
    date: '2026-07-14',
    weekdayLabel: '화',
    dayLabel: '14',
    isComplete: false,
    hasTodos: true,
    isToday: false,
    destination: 'aido://feed?date=2026-07-14',
  },
  {
    date: '2026-07-15',
    weekdayLabel: '수',
    dayLabel: '15',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-15',
  },
  {
    date: '2026-07-16',
    weekdayLabel: '목',
    dayLabel: '16',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-16',
  },
  {
    date: '2026-07-17',
    weekdayLabel: '금',
    dayLabel: '17',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-17',
  },
  {
    date: '2026-07-18',
    weekdayLabel: '토',
    dayLabel: '18',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-18',
  },
];

const KO_TOMORROW_WEEK = [
  {
    date: '2026-07-12',
    weekdayLabel: '일',
    dayLabel: '12',
    isComplete: false,
    hasTodos: false,
    isToday: false,
    destination: 'aido://feed?date=2026-07-12',
  },
  {
    date: '2026-07-13',
    weekdayLabel: '월',
    dayLabel: '13',
    isComplete: false,
    hasTodos: false,
    isToday: true,
    destination: 'aido://feed?date=today',
  },
  ...KO_TODAY_WEEK.slice(2),
];

const KO_TOMORROW_PROPS = {
  maxRows: 4,
  totalTodos: 0,
  completedTodos: 0,
  completionRate: 0,
  isComplete: false,
  currentStreak: 3,
  topTodos: [],
  openAppUrl: 'aido://feed?date=today',
  addTodoUrl: 'aido://feed?date=today&action=add-todo',
  weekDays: KO_TOMORROW_WEEK,
  weekTitle: '7월 3주차',
  weekRangeLabel: '07.12 ~ 07.18',
  addTodoLabel: '할 일 만들기',
  openTodoLabel: '할 일을 누르면 앱에서 열려요',
  progressTitle: '오늘의 할 일',
  percentLabel: '0%',
  compactStreakLabel: '3일',
  allDoneLabel: '모두 완료!',
  moreLabelTemplate: '+{count}개 더',
};

const EN_ALL_DONE_PROPS = {
  maxRows: 4,
  totalTodos: 2,
  completedTodos: 2,
  completionRate: 100,
  isComplete: true,
  currentStreak: 1,
  topTodos: [
    {
      id: 21,
      title: 'Morning run',
      completed: true,
      color: '#B3E5C1',
      destination: 'aido://todo/21',
    },
    { id: 22, title: 'Read', completed: true, color: '#FFB3B3', destination: 'aido://todo/22' },
  ],
  openAppUrl: 'aido://feed?date=today',
  addTodoUrl: 'aido://feed?date=today&action=add-todo',
  weekDays: [
    {
      date: '2026-07-12',
      weekdayLabel: 'Sun',
      dayLabel: '12',
      isComplete: true,
      hasTodos: true,
      isToday: true,
      destination: 'aido://feed?date=today',
    },
    {
      date: '2026-07-13',
      weekdayLabel: 'Mon',
      dayLabel: '13',
      isComplete: false,
      hasTodos: false,
      isToday: false,
      destination: 'aido://feed?date=2026-07-13',
    },
    {
      date: '2026-07-14',
      weekdayLabel: 'Tue',
      dayLabel: '14',
      isComplete: false,
      hasTodos: true,
      isToday: false,
      destination: 'aido://feed?date=2026-07-14',
    },
    {
      date: '2026-07-15',
      weekdayLabel: 'Wed',
      dayLabel: '15',
      isComplete: false,
      hasTodos: false,
      isToday: false,
      destination: 'aido://feed?date=2026-07-15',
    },
    {
      date: '2026-07-16',
      weekdayLabel: 'Thu',
      dayLabel: '16',
      isComplete: false,
      hasTodos: false,
      isToday: false,
      destination: 'aido://feed?date=2026-07-16',
    },
    {
      date: '2026-07-17',
      weekdayLabel: 'Fri',
      dayLabel: '17',
      isComplete: false,
      hasTodos: false,
      isToday: false,
      destination: 'aido://feed?date=2026-07-17',
    },
    {
      date: '2026-07-18',
      weekdayLabel: 'Sat',
      dayLabel: '18',
      isComplete: false,
      hasTodos: false,
      isToday: false,
      destination: 'aido://feed?date=2026-07-18',
    },
  ],
  weekTitle: 'Week 3 of Jul',
  weekRangeLabel: '07.12 – 07.18',
  addTodoLabel: 'Add to-do',
  openTodoLabel: 'Tap a to-do to open it',
  progressTitle: "Today's to-dos",
  percentLabel: '100%',
  compactStreakLabel: '1d',
  allDoneLabel: 'All done!',
  moreLabelTemplate: '+{count} more',
};

describe('iOS 위젯 timeline에 넘기는 props', () => {
  setupWidgetPayloadClock();

  afterEach(async () => {
    await act(() => i18n.changeLanguage('ko'));
  });

  it('완료가 섞인 오늘과 할 일 없는 내일은 지금·다음 자정·그다음 자정 세 칸으로 넘긴다', async () => {
    // When
    await syncWidget('authenticated');

    // Then
    expect(writtenTimelines()).toEqual([
      [
        [
          {
            date: new Date('2026-07-12T09:00:00.000Z'),
            props: {
              state: 'data',
              maxRows: 4,
              totalTodos: 4,
              completedTodos: 2,
              completionRate: 50,
              isComplete: false,
              currentStreak: 3,
              topTodos: [
                {
                  id: 11,
                  title: '운동하기',
                  completed: true,
                  color: '#B3E5C1',
                  destination: 'aido://todo/11',
                },
                {
                  id: 12,
                  title: '분기 보고서 초안을 정리하고 팀 공유 문서에 올린 뒤 피드백 받기',
                  completed: false,
                  color: '#ffb3b3',
                  destination: 'aido://todo/12',
                },
                {
                  id: 13,
                  title: '장보기',
                  completed: false,
                  color: '#FF6B43',
                  destination: 'aido://todo/13',
                },
                {
                  id: 14,
                  title: '물 마시기',
                  completed: true,
                  color: '#FF6B43',
                  destination: 'aido://todo/14',
                },
              ],
              openAppUrl: 'aido://feed?date=today',
              addTodoUrl: 'aido://feed?date=today&action=add-todo',
              weekDays: KO_TODAY_WEEK,
              weekTitle: '7월 3주차',
              weekRangeLabel: '07.12 ~ 07.18',
              addTodoLabel: '할 일 만들기',
              openTodoLabel: '할 일을 누르면 앱에서 열려요',
              progressTitle: '오늘의 할 일',
              percentLabel: '50%',
              compactStreakLabel: '3일',
              allDoneLabel: '모두 완료!',
              moreLabelTemplate: '+{count}개 더',
              stateTitle: '오늘은 아직 할 일이 없어요',
              stateCta: '오늘의 첫 할 일 만들기',
            },
          },
          {
            date: new Date('2026-07-12T15:00:00.000Z'),
            props: {
              state: 'empty',
              ...KO_TOMORROW_PROPS,
              stateTitle: '오늘은 아직 할 일이 없어요',
              stateCta: '오늘의 첫 할 일 만들기',
            },
          },
          {
            date: new Date('2026-07-13T15:00:00.000Z'),
            props: {
              state: 'stale',
              ...KO_TOMORROW_PROPS,
              stateTitle: '새로운 하루가 시작됐어요',
              stateCta: '앱을 열어 확인하기',
            },
          },
        ],
      ],
    ]);
  });

  it('영어로 모두 끝낸 오늘은 내일을 받지 못하면 다음 자정부터 새 날 안내다', async () => {
    // Given
    await act(() => i18n.changeLanguage('en'));

    // When
    await syncWidget('authenticated', ALL_DONE_TODAY_WITHOUT_TOMORROW);

    // Then
    expect(writtenTimelines()).toEqual([
      [
        [
          {
            date: new Date('2026-07-12T09:00:00.000Z'),
            props: {
              state: 'data',
              ...EN_ALL_DONE_PROPS,
              stateTitle: 'No to-dos for today yet',
              stateCta: 'Add your first to-do',
            },
          },
          {
            date: new Date('2026-07-12T15:00:00.000Z'),
            props: {
              state: 'stale',
              ...EN_ALL_DONE_PROPS,
              stateTitle: 'A fresh day is here',
              stateCta: 'Open Aido for today’s plans',
            },
          },
        ],
      ],
    ]);
  });

  it('로그아웃은 할 일 없이 로그인 안내 한 칸만 넘긴다', async () => {
    // When
    await syncWidget('unauthenticated');

    // Then
    expect(writtenTimelines()).toEqual([
      [
        [
          {
            date: new Date('2026-07-12T09:00:00.000Z'),
            props: {
              state: 'loggedOut',
              maxRows: 4,
              totalTodos: 0,
              completedTodos: 0,
              completionRate: 0,
              isComplete: false,
              currentStreak: 0,
              topTodos: [],
              openAppUrl: 'aido://feed?date=today',
              addTodoUrl: 'aido://feed?date=today&action=add-todo',
              addTodoLabel: '할 일 만들기',
              openTodoLabel: '할 일을 누르면 앱에서 열려요',
              progressTitle: '오늘의 할 일',
              percentLabel: '0%',
              compactStreakLabel: '0일',
              allDoneLabel: '모두 완료!',
              moreLabelTemplate: '+{count}개 더',
              stateTitle: '로그인이 필요해요',
              stateCta: '앱을 열어 시작하기',
            },
          },
        ],
      ],
    ]);
  });
});
