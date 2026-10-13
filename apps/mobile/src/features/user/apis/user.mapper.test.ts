import { createCurrentUserDto, createUpdateProfileDto } from '../__tests__/user.factories';
import { toUpdateProfileResult, toUser } from './user.mapper';

describe('toUser', () => {
  test('userId → id, createdAt ISO → Date 매핑', () => {
    // Given
    const dto = createCurrentUserDto();

    // When
    const result = toUser(dto);

    // Then
    expect(result.id).toBe(dto.userId);
    expect(result.email).toBe(dto.email);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(dto.createdAt);
  });

  test('name null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ name: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.name).toBeNull();
  });

  test('profileImage null → null 유지', () => {
    // Given
    const dto = createCurrentUserDto({ profileImage: null });

    // When
    const result = toUser(dto);

    // Then
    expect(result.profileImage).toBeNull();
  });

  test('providers 배열 매핑', () => {
    // Given
    const dto = createCurrentUserDto({ providers: ['CREDENTIAL', 'GOOGLE'] });

    // When
    const result = toUser(dto);

    // Then
    expect(result.providers).toEqual(['CREDENTIAL', 'GOOGLE']);
  });
});

describe('toUpdateProfileResult', () => {
  test('name, profileImage만 추출 (message 제외)', () => {
    // Given
    const dto = createUpdateProfileDto();

    // When
    const result = toUpdateProfileResult(dto);

    // Then
    expect(result).toEqual({
      name: dto.name,
      profileImage: dto.profileImage,
    });
    expect(result).not.toHaveProperty('message');
  });

  test('name null → null 유지', () => {
    // Given
    const dto = createUpdateProfileDto({ name: null });

    // When
    const result = toUpdateProfileResult(dto);

    // Then
    expect(result.name).toBeNull();
  });
});
