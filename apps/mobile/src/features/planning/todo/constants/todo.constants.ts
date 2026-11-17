/** 시간대 안내를 띄울지 보려고 앞으로 읽는 기간. 서버는 시간 있는 할 일을 모두 다시 계산하지만 안내는 이 안에 울릴 할 일이 있을 때만 띄운다 */
export const UPCOMING_TODO_WINDOW_DAYS = 31;

/** 날짜·반복 시트 달력의 날짜 칸 높이. 두 시트가 같은 칸으로 그린다 */
export const PICKER_DATE_CELL_HEIGHT = 48;

/** 달마다 4~6주라 6주 높이를 미리 잡아 달을 넘겨도 시트 높이가 변하지 않게 한다 */
export const PICKER_MONTH_HEIGHT = PICKER_DATE_CELL_HEIGHT * 6;
