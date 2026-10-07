/**
 * GridCoordinate 값 객체 단위 테스트
 */
import { GridCoordinate } from "./grid-coordinate.vo.js";

describe("GridCoordinate — 저장 격자 값 객체", () => {
  it("격자 좌표를 생성하고 getter로 노출한다", () => {
    const grid = GridCoordinate.of(60, 127);

    expect(grid.gridX).toBe(60);
    expect(grid.gridY).toBe(127);
  });

  it.each([
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("정확한 정수로 저장할 수 없는 격자를 거부한다: %p", (value) => {
    expect(() => GridCoordinate.of(value, 127)).toThrow(
      expect.objectContaining({ errorCode: "SYS_0002", details: { field: "gridX", value } }),
    );
    expect(() => GridCoordinate.of(60, value)).toThrow(
      expect.objectContaining({ errorCode: "SYS_0002", details: { field: "gridY", value } }),
    );
  });

  describe("equals", () => {
    it("동일 격자면 true", () => {
      expect(GridCoordinate.of(60, 127).equals(GridCoordinate.of(60, 127))).toBe(true);
    });

    it("gridX가 다르면 false", () => {
      expect(GridCoordinate.of(60, 127).equals(GridCoordinate.of(61, 127))).toBe(false);
    });

    it("gridY가 다르면 false", () => {
      expect(GridCoordinate.of(60, 127).equals(GridCoordinate.of(60, 128))).toBe(false);
    });
  });
});
