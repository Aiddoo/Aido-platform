import { getPrimaryPaneWidth } from './get-primary-pane-width';

describe('getPrimaryPaneWidth', () => {
  it('medium은 320, expanded는 400을 반환한다', () => {
    expect(getPrimaryPaneWidth('medium')).toBe(320);
    expect(getPrimaryPaneWidth('expanded')).toBe(400);
  });
});
