'use no memo';

import type { ReactNode } from 'react';
import {
  FlexWidget,
  ListWidget,
  SvgWidget,
  TextWidget,
  type ClickActionProps,
  type ColorProp,
  type FlexWidgetStyle,
  type TextWidgetStyle,
  type WidgetInfo,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import { ANDROID_WIDGET_NAVIGATION_ACTION } from '../bridge/android-widget.constant';
import type { WidgetProps } from '../models/widget-props.model';

// SvgWidget needs inline SVG; Metro otherwise transforms ic_paw.svg into a React component.
const PAW_PATH =
  'M19.3629 7.76445C19.1461 7.24922 18.7859 6.87773 18.3211 6.69062L18.3148 6.68828C18.1033 6.60545 17.878 6.56305 17.6508 6.56328H17.6258C16.5617 6.5793 15.4754 7.48359 14.923 8.81367C14.518 9.78633 14.4715 10.8324 14.7988 11.6121C15.0152 12.1277 15.3762 12.4992 15.843 12.6863L15.848 12.6883C16.0596 12.7711 16.2849 12.8135 16.5121 12.8133C17.5863 12.8133 18.684 11.909 19.2465 10.5613C19.6465 9.58984 19.6906 8.54453 19.3629 7.76445ZM15.1113 13.5012C14.4977 13.1324 13.9176 12.7836 13.5387 12.157C12.4934 10.4227 11.8621 9.37578 10.207 9.37578C8.55195 9.37578 7.91914 10.4227 6.87148 12.157C6.4918 12.7844 5.91055 13.1336 5.29492 13.5039C4.58906 13.9281 3.85977 14.3664 3.54492 15.2289C3.4225 15.5398 3.36084 15.8713 3.36328 16.2055C3.36328 17.6098 4.45703 18.7523 5.80078 18.7523C6.49414 18.7523 7.23203 18.5121 8.01289 18.2578C8.76367 18.0133 9.53984 17.7605 10.2109 17.7605C10.882 17.7605 11.6562 18.0133 12.4043 18.2578C13.1836 18.5105 13.918 18.7508 14.6133 18.7508C15.9551 18.7508 17.0469 17.6082 17.0469 16.2039C17.048 15.8695 16.985 15.538 16.8613 15.2273C16.5465 14.3641 15.8168 13.9254 15.1113 13.5012ZM6.06641 8.00273C6.53125 8.58594 7.12109 8.90703 7.72734 8.90703C7.81011 8.90701 7.89275 8.90088 7.97461 8.88867C9.23906 8.70273 10.027 7.15977 9.76836 5.37305C9.66016 4.62188 9.37109 3.92227 8.95703 3.40352C8.49297 2.82148 7.90234 2.50078 7.29648 2.50078C7.21372 2.5008 7.13108 2.50694 7.04922 2.51914C5.78477 2.70508 4.99688 4.24805 5.25547 6.03477C5.36328 6.78477 5.65234 7.48359 6.06641 8.00273ZM12.4398 8.88867C12.5217 8.90088 12.6043 8.90701 12.6871 8.90703C13.2937 8.90703 13.8832 8.58594 14.348 8.00273C14.7617 7.48359 15.0492 6.78477 15.1586 6.03398C15.4172 4.24805 14.6293 2.70508 13.3648 2.51836C13.283 2.50616 13.2003 2.50002 13.1176 2.5C12.5117 2.50078 11.9211 2.82148 11.457 3.40352C11.043 3.92227 10.7539 4.62188 10.6461 5.37383C10.3875 7.15977 11.1754 8.70273 12.4398 8.88867ZM4.56602 12.6883L4.57148 12.6863C5.0375 12.4992 5.39805 12.1281 5.61406 11.6129C5.94141 10.8316 5.89531 9.78672 5.49102 8.81406C4.93125 7.46797 3.83398 6.56328 2.76094 6.56328C2.53371 6.56295 2.30844 6.60536 2.09688 6.68828L2.09141 6.69023C1.62656 6.87578 1.26602 7.24844 1.05 7.76367C0.722657 8.54492 0.768751 9.58984 1.17305 10.5625C1.73281 11.9086 2.83008 12.8133 3.90313 12.8133C4.12996 12.8135 4.35482 12.7711 4.56602 12.6883Z';
const BRAND = '#FF6B43';

type Palette = {
  background: ColorProp;
  foreground: ColorProp;
  muted: ColorProp;
  track: ColorProp;
  brandSurface: ColorProp;
};

type Layout = {
  props: WidgetProps;
  userId: string | null;
  palette: Palette;
  scale: number;
  width: number;
  height: number;
  cardHeight: number;
  padding: number;
  contentWidth: number;
  isSmall: boolean;
  isLarge: boolean;
};

function navigation(
  layout: Layout,
  destination?: string,
  accessibilityLabel?: string,
): ClickActionProps {
  return {
    clickAction: ANDROID_WIDGET_NAVIGATION_ACTION,
    clickActionData: {
      uri: destination ?? layout.props.openAppUrl ?? 'aido://feed?date=today',
      userId: layout.userId,
    },
    accessibilityLabel,
  };
}

function Label({
  layout,
  text,
  size,
  color = layout.palette.foreground,
  weight = 'normal',
  maxLines = 1,
  style,
}: {
  layout: Layout;
  text: string;
  size: number;
  color?: ColorProp;
  weight?: TextWidgetStyle['fontWeight'];
  maxLines?: number;
  style?: TextWidgetStyle;
}) {
  return (
    <TextWidget
      text={text}
      maxLines={maxLines}
      truncate="END"
      allowFontScaling={false}
      style={{ fontSize: size * layout.scale, fontWeight: weight, color, ...style }}
    />
  );
}

function Paw({ layout, size = 11 }: { layout: Layout; size?: number }) {
  return (
    <SvgWidget
      svg={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20"><g fill="${BRAND}"><path transform="translate(0 .5) scale(.6)" d="${PAW_PATH}"/><path transform="translate(11.5 7.5) scale(.6)" d="${PAW_PATH}"/></g></svg>`}
      style={{
        width: ((24 * size) / 11) * layout.scale,
        height: ((20 * size) / 11) * layout.scale,
      }}
    />
  );
}

function Progress({ layout, width, height }: { layout: Layout; width: number; height: number }) {
  const progress = Math.min(100, Math.max(0, layout.props.completionRate));
  return (
    <FlexWidget
      style={{
        width,
        height: height * layout.scale,
        backgroundColor: layout.palette.track,
        borderRadius: height * layout.scale,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {progress > 0 ? (
        <FlexWidget
          style={{
            width: (width * progress) / 100,
            height: 'match_parent',
            backgroundColor: BRAND,
            borderRadius: height * layout.scale,
          }}
        />
      ) : null}
    </FlexWidget>
  );
}

function Count({ layout, size, width }: { layout: Layout; size: number; width: number }) {
  const { completedTodos, totalTodos } = layout.props;
  const digits = String(completedTodos).length + String(totalTodos).length;
  const fontScale = Math.min(1, 4 / digits);
  return (
    <FlexWidget
      style={{
        width,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: layout.isLarge ? 'flex-end' : 'flex-start',
        flexGap: 2 * layout.scale,
      }}
    >
      <Label
        layout={layout}
        text={String(completedTodos)}
        size={size * fontScale}
        weight="bold"
        color={BRAND}
      />
      <Label
        layout={layout}
        text={`/${totalTodos}`}
        size={Math.round(size * 0.55) * fontScale}
        weight="600"
        color={layout.palette.muted}
        style={{ paddingBottom: 2 * layout.scale }}
      />
    </FlexWidget>
  );
}

function TodoRow({ layout, todo }: { layout: Layout; todo: WidgetProps['topTodos'][number] }) {
  const { palette, scale } = layout;
  const color: ColorProp = /^#[0-9a-f]{6}$/i.test(todo.color) ? (todo.color as ColorProp) : BRAND;
  return (
    <FlexWidget
      {...navigation(layout, todo.destination, todo.title)}
      style={{
        width: 'match_parent',
        height: (layout.isLarge ? 27 : 30) * scale,
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 8 * scale,
      }}
    >
      <FlexWidget
        style={{
          width: 16 * scale,
          height: 16 * scale,
          borderRadius: 5 * scale,
          borderWidth: todo.completed ? 0 : 2 * scale,
          borderColor: color,
          backgroundColor: todo.completed ? color : palette.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {todo.completed ? (
          <Label layout={layout} text="✓" size={10} weight="bold" color="#FFFFFF" />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ width: 0, flex: 1 }}>
        <Label
          layout={layout}
          text={todo.title}
          size={13}
          color={todo.completed ? palette.muted : palette.foreground}
          style={{ width: 'match_parent' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function CreateButton({ layout }: { layout: Layout }) {
  const label = layout.props.addTodoLabel ?? layout.props.stateCta;
  return (
    <FlexWidget
      {...navigation(layout, layout.props.addTodoUrl, label)}
      style={{
        backgroundColor: layout.palette.brandSurface,
        borderRadius: 9 * layout.scale,
        paddingHorizontal: 10 * layout.scale,
        paddingVertical: 6 * layout.scale,
      }}
    >
      <Label layout={layout} text={`＋ ${label}`} size={12} weight="600" color={BRAND} />
    </FlexWidget>
  );
}

function WeekDay({
  layout,
  day,
  index,
}: {
  layout: Layout;
  day: NonNullable<WidgetProps['weekDays']>[number];
  index: number;
}) {
  const { scale, palette } = layout;
  return (
    <FlexWidget
      {...navigation(layout, day.destination, `${day.weekdayLabel} ${day.dayLabel}`)}
      style={{ width: layout.contentWidth / 7, alignItems: 'center', flexGap: 4 * scale }}
    >
      <Label
        layout={layout}
        text={day.weekdayLabel}
        size={10}
        color={index === 0 ? '#FF5858' : index === 6 ? '#2598E8' : palette.muted}
      />
      <FlexWidget
        style={{
          width: 28 * scale,
          height: 28 * scale,
          borderRadius: 14 * scale,
          backgroundColor: day.isToday ? BRAND : '#00000000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Label
          layout={layout}
          text={day.dayLabel}
          size={14}
          weight={day.isToday ? 'bold' : '500'}
          color={day.isToday ? '#FFFFFF' : palette.foreground}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          width: 24 * scale,
          height: 14 * scale,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {day.isComplete ? (
          <Paw layout={layout} size={7} />
        ) : (
          <Label layout={layout} text={day.hasTodos ? '•' : ' '} size={14} color={BRAND} />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

function Surface({
  layout,
  children,
  style,
}: {
  layout: Layout;
  children: ReactNode;
  style?: FlexWidgetStyle;
}) {
  return (
    <FlexWidget
      style={{
        width: layout.width,
        height: layout.height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FlexWidget
        {...navigation(
          layout,
          undefined,
          layout.props.state === 'data' ? layout.props.progressTitle : layout.props.stateTitle,
        )}
        style={{
          width: layout.width,
          height: layout.cardHeight,
          padding: layout.padding,
          backgroundColor: layout.palette.background,
          borderRadius: 20 * layout.scale,
          overflow: 'hidden',
          ...style,
        }}
      >
        {children}
      </FlexWidget>
    </FlexWidget>
  );
}

function StateSurface({ layout }: { layout: Layout }) {
  return (
    <Surface
      layout={layout}
      style={{ alignItems: 'center', justifyContent: 'center', flexGap: 6 * layout.scale }}
    >
      <Paw layout={layout} />
      <Label
        layout={layout}
        text={layout.props.stateTitle}
        size={14}
        weight="600"
        maxLines={2}
        style={{ width: 'match_parent', textAlign: 'center' }}
      />
      <Label
        layout={layout}
        text={layout.props.stateCta}
        size={12}
        color={layout.palette.muted}
        maxLines={2}
        style={{ width: 'match_parent', textAlign: 'center' }}
      />
    </Surface>
  );
}

function SmallSurface({ layout }: { layout: Layout }) {
  const { props, scale, palette, contentWidth } = layout;
  return (
    <Surface layout={layout} style={{ justifyContent: 'center', flexGap: 8 * scale }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <Label
            layout={layout}
            text={props.progressTitle}
            size={12}
            weight="500"
            color={palette.muted}
            style={{ width: 'match_parent', adjustsFontSizeToFit: true }}
          />
        </FlexWidget>
        <Paw layout={layout} />
      </FlexWidget>
      <Count layout={layout} size={34} width={contentWidth} />
      <Progress layout={layout} width={contentWidth} height={6} />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <Label
            layout={layout}
            text={props.isComplete ? props.allDoneLabel : props.percentLabel}
            size={11}
            weight="500"
            color={props.isComplete ? BRAND : palette.muted}
            style={{ width: 'match_parent', adjustsFontSizeToFit: true }}
          />
        </FlexWidget>
        {props.currentStreak > 0 ? (
          <Label
            layout={layout}
            text={`🔥 ${props.compactStreakLabel}`}
            size={11}
            weight="500"
            color={BRAND}
          />
        ) : null}
      </FlexWidget>
    </Surface>
  );
}

function MediumSurface({ layout }: { layout: Layout }) {
  const { props, palette, scale } = layout;
  const summaryWidth = 82 * scale;
  return (
    <Surface
      layout={layout}
      style={{ flexDirection: 'row', alignItems: 'center', flexGap: 16 * scale }}
    >
      <FlexWidget style={{ width: summaryWidth, flexGap: 8 * scale }}>
        <Label
          layout={layout}
          text={props.progressTitle}
          size={11}
          weight="500"
          color={palette.muted}
          style={{ width: 'match_parent', adjustsFontSizeToFit: true }}
        />
        <Count layout={layout} size={32} width={summaryWidth} />
        <Progress layout={layout} width={summaryWidth} height={4} />
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 4 * scale,
          }}
        >
          <Paw layout={layout} />
          <FlexWidget style={{ width: 0, flex: 1 }}>
            <Label
              layout={layout}
              text={props.currentStreak > 0 ? props.compactStreakLabel : props.percentLabel}
              size={11}
              color={BRAND}
              style={{ width: 'match_parent', adjustsFontSizeToFit: true }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
      <FlexWidget
        style={{ width: scale, height: 'match_parent', backgroundColor: palette.track }}
      />
      <FlexWidget style={{ width: 0, flex: 1, flexGap: 4 * scale }}>
        {props.state === 'empty' ? (
          <Label
            layout={layout}
            text={props.stateTitle}
            size={12}
            color={palette.muted}
            maxLines={2}
            style={{ height: 60 * scale, width: 'match_parent' }}
          />
        ) : (
          props.topTodos
            .slice(0, 2)
            .map((todo, index) => <TodoRow key={todo.id ?? index} layout={layout} todo={todo} />)
        )}
        <FlexWidget style={{ flexDirection: 'row' }}>
          <CreateButton layout={layout} />
        </FlexWidget>
      </FlexWidget>
    </Surface>
  );
}

function LargeSurface({ layout }: { layout: Layout }) {
  const { props, palette, scale, contentWidth } = layout;
  const visibleTodos = props.topTodos.slice(0, 4);
  const hiddenTodoCount = Math.max(0, props.totalTodos - visibleTodos.length);
  return (
    <Surface layout={layout} style={{ flexGap: 8 * scale }}>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 4 * scale,
        }}
      >
        <FlexWidget
          style={{
            width: 0,
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 4 * scale,
          }}
        >
          <Label
            layout={layout}
            text={props.weekTitle ?? props.progressTitle}
            size={14}
            weight="600"
            style={{ adjustsFontSizeToFit: true }}
          />
          <Paw layout={layout} />
        </FlexWidget>
        {props.weekRangeLabel ? (
          <Label layout={layout} text={props.weekRangeLabel} size={10} color={palette.muted} />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        {props.weekDays?.slice(0, 7).map((day, index) => (
          <WeekDay key={day.date} layout={layout} day={day} index={index} />
        ))}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <Label
            layout={layout}
            text={props.progressTitle}
            size={12}
            weight="500"
            color={palette.muted}
            style={{ width: 'match_parent', adjustsFontSizeToFit: true }}
          />
        </FlexWidget>
        <Count layout={layout} size={22} width={Math.min(contentWidth * 0.4, 90 * scale)} />
      </FlexWidget>
      <Progress layout={layout} width={contentWidth} height={4} />
      <FlexWidget style={{ width: 'match_parent', flexGap: 2 * scale }}>
        {props.state === 'empty' ? (
          <Label
            layout={layout}
            text={props.stateTitle}
            size={13}
            color={palette.muted}
            maxLines={2}
            style={{ height: 108 * scale, width: 'match_parent' }}
          />
        ) : (
          visibleTodos.map((todo, index) => (
            <TodoRow key={todo.id ?? index} layout={layout} todo={todo} />
          ))
        )}
      </FlexWidget>
      <FlexWidget style={{ height: 0, flex: 1 }} />
      <FlexWidget
        style={{ width: 'match_parent', height: scale, backgroundColor: palette.track }}
      />
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 8 * scale,
        }}
      >
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <Label
            layout={layout}
            text={
              hiddenTodoCount > 0
                ? props.moreLabelTemplate.replace('{count}', String(hiddenTodoCount))
                : (props.openTodoLabel ?? '')
            }
            size={10}
            color={palette.muted}
            style={{ width: 'match_parent' }}
          />
        </FlexWidget>
        <CreateButton layout={layout} />
      </FlexWidget>
    </Surface>
  );
}

export function renderAndroidWidget(
  props: WidgetProps,
  widgetInfo: WidgetInfo,
  userId: string | null,
): WidgetRepresentation {
  const isSmall = props.maxRows === 0;
  const isLarge = props.maxRows > 3;
  const resolveDimension = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const width = resolveDimension(widgetInfo.width, isSmall ? 160 : 340);
  const height = resolveDimension(widgetInfo.height, isLarge ? 380 : 160);
  const cardHeight = Math.min(height, width / (isSmall ? 1 : isLarge ? 0.97 : 2.05));
  const scale = Math.min(1, width / (isSmall ? 160 : 340), cardHeight / (isLarge ? 380 : 160));
  // Include WidgetKit's content margins so all three cards keep the same visual spacing.
  const padding = (isSmall ? 28 : 32) * scale;
  const base = {
    props,
    userId,
    width,
    height,
    cardHeight,
    scale,
    padding,
    contentWidth: width - padding * 2,
    isSmall,
    isLarge,
  };
  const render = (dark: boolean) => {
    const layout: Layout = {
      ...base,
      palette: {
        background: dark ? '#171310' : '#FFFFFF',
        foreground: dark ? '#F5F5F5' : '#333333',
        muted: dark ? '#B7B7B7' : '#8F8F8F',
        track: dark ? '#333333' : '#EBEBEB',
        brandSurface: dark ? '#3E2118' : '#FFF0EB',
      },
    };
    if (
      props.state === 'loggedOut' ||
      props.state === 'stale' ||
      (props.state === 'empty' && isSmall)
    )
      return <StateSurface layout={layout} />;
    if (isSmall) return <SmallSurface layout={layout} />;
    return isLarge ? <LargeSurface layout={layout} /> : <MediumSurface layout={layout} />;
  };
  const collection = (dark: boolean) => (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent' }}>
      <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
        {render(dark)}
      </ListWidget>
    </FlexWidget>
  );
  return { light: collection(false), dark: collection(true) };
}
