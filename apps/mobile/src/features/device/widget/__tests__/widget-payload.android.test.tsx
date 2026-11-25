/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import { i18n } from '@src/shared/i18n';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { act } from '@testing-library/react-native';

import {
  ALL_DONE_TODAY_WITHOUT_TOMORROW,
  setupWidgetPayloadClock,
  syncWidget,
  WIDGET_PAYLOAD_ACCOUNT_ID,
} from './widget-payload.test-utils';

// 출시한 Android 위젯이 앱 없이 읽는 저장 키와 원문이다. 키·칸 이름·칸 순서를 바꾸면 업데이트한 사용자의 위젯이 빈다
const SNAPSHOT_KEY = 'aido_widget_snapshot_v1';
const OWNER_KEY = 'aido_widget_snapshot_user_id_v1';

// 원문은 칸 순서까지 같아야 한다. 수에 따라 바뀌는 앞 칸(progressTitle~compactStreakLabel) 뒤에 펼친다
const KO_STRINGS = {
  allDoneLabel: '모두 완료!',
  moreLabelTemplate: '+{count}개 더',
  emptyTitle: '오늘은 아직 할 일이 없어요',
  emptyCta: '오늘의 첫 할 일 만들기',
  loggedOutTitle: '로그인이 필요해요',
  loggedOutCta: '앱을 열어 시작하기',
  staleTitle: '새로운 하루가 시작됐어요',
  staleCta: '앱을 열어 확인하기',
  addTodoLabel: '할 일 만들기',
  openTodoLabel: '할 일을 누르면 앱에서 열려요',
};

const KO_WEEK_AFTER_SUNDAY = [
  { date: '2026-07-14', weekdayLabel: '화', dayLabel: '14', isComplete: false, hasTodos: true },
  { date: '2026-07-15', weekdayLabel: '수', dayLabel: '15', isComplete: false, hasTodos: false },
  { date: '2026-07-16', weekdayLabel: '목', dayLabel: '16', isComplete: false, hasTodos: false },
  { date: '2026-07-17', weekdayLabel: '금', dayLabel: '17', isComplete: false, hasTodos: false },
  { date: '2026-07-18', weekdayLabel: '토', dayLabel: '18', isComplete: false, hasTodos: false },
];

describe('Android 위젯 저장소에 쓰는 원문', () => {
  setupWidgetPayloadClock();

  afterEach(async () => {
    widgetStorage.remove(SNAPSHOT_KEY);
    widgetStorage.remove(OWNER_KEY);
    await act(() => i18n.changeLanguage('ko'));
  });

  it('완료가 섞인 오늘과 할 일 없는 내일을 한 원문에 쓰고 주인을 따로 둔다', async () => {
    // When
    await syncWidget('authenticated');

    // Then
    expect(widgetStorage.get(SNAPSHOT_KEY)).toBe(
      JSON.stringify({
        version: 2,
        updatedAtIso: '2026-07-12T09:00:00.000Z',
        days: [
          {
            state: 'data',
            date: '2026-07-12',
            totalTodos: 4,
            completedTodos: 2,
            completionRate: 50,
            isComplete: false,
            currentStreak: 3,
            topTodos: [
              { id: 11, title: '운동하기', completed: true, categoryColor: '#B3E5C1' },
              {
                id: 12,
                title: '분기 보고서 초안을 정리하고 팀 공유 문서에 올린 뒤 피드백 받기',
                completed: false,
                categoryColor: '#ffb3b3',
              },
              { id: 13, title: '장보기', completed: false, categoryColor: 'red' },
              { id: 14, title: '물 마시기', completed: true, categoryColor: '#FF6B43' },
            ],
            locale: 'ko',
            weekDays: [
              {
                date: '2026-07-12',
                weekdayLabel: '일',
                dayLabel: '12',
                isComplete: false,
                hasTodos: true,
              },
              {
                date: '2026-07-13',
                weekdayLabel: '월',
                dayLabel: '13',
                isComplete: false,
                hasTodos: false,
              },
              ...KO_WEEK_AFTER_SUNDAY,
            ],
            strings: {
              progressTitle: '오늘의 할 일',
              percentLabel: '50%',
              streakLabel: '3일 연속',
              compactStreakLabel: '3일',
              ...KO_STRINGS,
              weekTitle: '7월 3주차',
              weekRangeLabel: '07.12 ~ 07.18',
            },
          },
          {
            state: 'empty',
            date: '2026-07-13',
            totalTodos: 0,
            completedTodos: 0,
            completionRate: 0,
            isComplete: false,
            currentStreak: 3,
            topTodos: [],
            locale: 'ko',
            weekDays: [
              {
                date: '2026-07-12',
                weekdayLabel: '일',
                dayLabel: '12',
                isComplete: false,
                hasTodos: false,
              },
              {
                date: '2026-07-13',
                weekdayLabel: '월',
                dayLabel: '13',
                isComplete: false,
                hasTodos: false,
              },
              ...KO_WEEK_AFTER_SUNDAY,
            ],
            strings: {
              progressTitle: '오늘의 할 일',
              percentLabel: '0%',
              streakLabel: '3일 연속',
              compactStreakLabel: '3일',
              ...KO_STRINGS,
              weekTitle: '7월 3주차',
              weekRangeLabel: '07.12 ~ 07.18',
            },
          },
        ],
      }),
    );
    expect(widgetStorage.get(OWNER_KEY)).toBe(WIDGET_PAYLOAD_ACCOUNT_ID);
  });

  it('영어로 모두 끝낸 오늘은 내일을 받지 못하면 오늘 하나만 쓴다', async () => {
    // Given
    await act(() => i18n.changeLanguage('en'));

    // When
    await syncWidget('authenticated', ALL_DONE_TODAY_WITHOUT_TOMORROW);

    // Then
    expect(widgetStorage.get(SNAPSHOT_KEY)).toBe(
      JSON.stringify({
        version: 2,
        updatedAtIso: '2026-07-12T09:00:00.000Z',
        days: [
          {
            state: 'data',
            date: '2026-07-12',
            totalTodos: 2,
            completedTodos: 2,
            completionRate: 100,
            isComplete: true,
            currentStreak: 1,
            topTodos: [
              { id: 21, title: 'Morning run', completed: true, categoryColor: '#B3E5C1' },
              { id: 22, title: 'Read', completed: true, categoryColor: '#FFB3B3' },
            ],
            locale: 'en',
            weekDays: [
              {
                date: '2026-07-12',
                weekdayLabel: 'Sun',
                dayLabel: '12',
                isComplete: true,
                hasTodos: true,
              },
              {
                date: '2026-07-13',
                weekdayLabel: 'Mon',
                dayLabel: '13',
                isComplete: false,
                hasTodos: false,
              },
              {
                date: '2026-07-14',
                weekdayLabel: 'Tue',
                dayLabel: '14',
                isComplete: false,
                hasTodos: true,
              },
              {
                date: '2026-07-15',
                weekdayLabel: 'Wed',
                dayLabel: '15',
                isComplete: false,
                hasTodos: false,
              },
              {
                date: '2026-07-16',
                weekdayLabel: 'Thu',
                dayLabel: '16',
                isComplete: false,
                hasTodos: false,
              },
              {
                date: '2026-07-17',
                weekdayLabel: 'Fri',
                dayLabel: '17',
                isComplete: false,
                hasTodos: false,
              },
              {
                date: '2026-07-18',
                weekdayLabel: 'Sat',
                dayLabel: '18',
                isComplete: false,
                hasTodos: false,
              },
            ],
            strings: {
              progressTitle: "Today's to-dos",
              percentLabel: '100%',
              streakLabel: '1-day streak',
              compactStreakLabel: '1d',
              allDoneLabel: 'All done!',
              moreLabelTemplate: '+{count} more',
              emptyTitle: 'No to-dos for today yet',
              emptyCta: 'Add your first to-do',
              loggedOutTitle: 'Sign in to get started',
              loggedOutCta: 'Tap to sign in',
              staleTitle: 'A fresh day is here',
              staleCta: 'Open Aido for today’s plans',
              addTodoLabel: 'Add to-do',
              openTodoLabel: 'Tap a to-do to open it',
              weekTitle: 'Week 3 of Jul',
              weekRangeLabel: '07.12 – 07.18',
            },
          },
        ],
      }),
    );
    expect(widgetStorage.get(OWNER_KEY)).toBe(WIDGET_PAYLOAD_ACCOUNT_ID);
  });

  it('로그아웃은 로그인 안내 하루만 쓰고 앞 계정의 주인 값을 지운다', async () => {
    // Given
    widgetStorage.set(OWNER_KEY, 'previous-account');

    // When
    await syncWidget('unauthenticated');

    // Then
    expect(widgetStorage.get(SNAPSHOT_KEY)).toBe(
      JSON.stringify({
        version: 2,
        updatedAtIso: '2026-07-12T09:00:00.000Z',
        days: [
          {
            state: 'loggedOut',
            date: '2026-07-12',
            totalTodos: 0,
            completedTodos: 0,
            completionRate: 0,
            isComplete: false,
            currentStreak: 0,
            topTodos: [],
            locale: 'ko',
            strings: {
              progressTitle: '오늘의 할 일',
              percentLabel: '0%',
              streakLabel: '0일 연속',
              compactStreakLabel: '0일',
              ...KO_STRINGS,
            },
          },
        ],
      }),
    );
    expect(widgetStorage.get(OWNER_KEY)).toBeUndefined();
  });
});
