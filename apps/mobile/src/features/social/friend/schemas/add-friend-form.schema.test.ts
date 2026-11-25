import { addFriendFormSchema } from './add-friend-form.schema';

describe('addFriendFormSchema', () => {
  it.each([
    ['ABCD1234', true],
    ['abcd1234', false],
    ['ABC123', false],
    ['ABCD123', false],
    ['ABCD12345', false],
    ['ABCD-123', false],
  ])('태그 "%s"를 보낼 수 있는지는 %s이다', (userTag, expected) => {
    // When
    const result = addFriendFormSchema.safeParse({ userTag });

    // Then
    expect(result.success).toBe(expected);
  });
});
