import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../app/index';

describe('HomeScreen', () => {
  it('홈 페이지 텍스트가 보여야 한다', () => {
    render(<HomeScreen />);
    expect(screen.getByText('홈 페이지')).toBeTruthy();
  });
});
