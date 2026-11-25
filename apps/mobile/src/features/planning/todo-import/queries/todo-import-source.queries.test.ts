import { createTodoImportCollection } from '../__tests__/todo-import.fixtures';
import { selectCollectionsByAccount, selectOrderedCollections } from './todo-import-source.queries';

describe('selectOrderedCollections', () => {
  it('기기 설정 앱처럼 계정 이름, 캘린더 이름 순이고 계정 이름이 없는 캘린더가 맨 앞이다', () => {
    // Given
    const work = createTodoImportCollection({
      collectionKey: 'work',
      title: '회사',
      accountName: 'iCloud',
    });
    const personal = createTodoImportCollection({
      collectionKey: 'personal',
      title: '개인',
      accountName: 'iCloud',
    });
    const gmail = createTodoImportCollection({
      collectionKey: 'gmail',
      title: '약속',
      accountName: 'Gmail',
    });
    const local = createTodoImportCollection({
      collectionKey: 'local',
      title: '메모',
      accountName: null,
    });

    // When
    const ordered = selectOrderedCollections([work, personal, gmail, local]);

    // Then
    expect(ordered.map(({ collectionKey }) => collectionKey)).toEqual([
      'local',
      'gmail',
      'personal',
      'work',
    ]);
  });
});

describe('selectCollectionsByAccount', () => {
  it('내 계정 캘린더를 계정마다 묶고 받아 보기만 하는 캘린더는 따로 모은다', () => {
    // Given
    const personal = createTodoImportCollection({
      collectionKey: 'personal',
      accountName: 'iCloud',
      accountKind: 'cloud',
      accountProvider: 'icloud',
    });
    const work = createTodoImportCollection({
      collectionKey: 'work',
      accountName: 'iCloud',
      accountKind: 'cloud',
      accountProvider: 'icloud',
    });
    const holidays = createTodoImportCollection({
      collectionKey: 'holidays',
      accountName: 'iCloud',
      accountKind: 'holidays',
      accountProvider: 'subscribed',
    });

    // When
    const { accounts, receivedCollections } = selectCollectionsByAccount([
      personal,
      holidays,
      work,
    ]);

    // Then
    expect(accounts).toEqual([
      { accountKey: 'iCloud', account: personal, collections: [personal, work] },
    ]);
    expect(receivedCollections).toEqual([holidays]);
  });

  it('구독·생일 계정은 내 계정 묶음 뒤에 둔다', () => {
    // Given
    const birthdays = createTodoImportCollection({
      collectionKey: 'birthday-calendar',
      accountName: 'A Contacts',
      accountKind: 'other',
      accountProvider: 'birthdays',
    });
    const google = createTodoImportCollection({
      collectionKey: 'google',
      accountName: 'B Google',
      accountKind: 'cloud',
      accountProvider: 'google',
    });

    // When
    const { accounts } = selectCollectionsByAccount([birthdays, google]);

    // Then
    expect(accounts.map(({ accountKey }) => accountKey)).toEqual(['B Google', 'A Contacts']);
  });
});
