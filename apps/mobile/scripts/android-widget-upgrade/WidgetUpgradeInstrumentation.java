package dev.aido.widgetqa;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.lang.reflect.*;
import java.util.*;
import org.json.*;

public final class WidgetUpgradeInstrumentation extends Instrumentation {
  private Bundle args;
  private final String[] names = {"AidoTodaySummary", "AidoTodayList", "AidoTodayLarge"};

  @Override
  public void onCreate(Bundle args) {
    this.args = args;
    start();
  }

  @Override
  public void onStart() {
    Bundle result = new Bundle();
    try {
      Context context = getTargetContext();
      JSONObject report = new JSONObject();
      AppWidgetManager manager = AppWidgetManager.getInstance(context);
      SharedPreferences qa = context.getSharedPreferences("aido.widget.upgrade.qa", 0);
      if ("seed".equals(args.getString("mode"))) {
        writeSnapshot(context, args.getString("snapshot"));
        AppWidgetHost host = new AppWidgetHost(context, 5810);
        SharedPreferences.Editor editor = qa.edit();
        for (String name : names) {
          int id = host.allocateAppWidgetId();
          ComponentName component =
              new ComponentName(
                  context.getPackageName(), context.getPackageName() + ".widget." + name);
          if (!manager.bindAppWidgetIdIfAllowed(id, component))
            throw new IllegalStateException("Bind denied " + name);
          editor.putInt(name, id);
          report.put(name, id);
          context
              .getSharedPreferences(context.getPackageName() + ".WIDGET_SIZES", 0)
              .edit()
              .putInt(id + "-width", 110)
              .putInt(id + "-height", 110)
              .commit();
        }
        editor.commit();
      } else {
        SharedPreferences sdk = context.getSharedPreferences("expo.modules.widgets", 0);
        if ("corrupt".equals(args.getString("mode"))) {
          sdk.edit().clear().commit();
          writeSnapshot(
              context, args.containsKey("snapshot") ? args.getString("snapshot") : "broken-json");
        }
        if ("preserve".equals(args.getString("mode"))) {
          for (String name : names)
            sdk.edit()
                .putString(
                    "__expo_widgets_" + name + "_props", freshProps(args.getString("props"), name))
                .commit();
        }
        if ("race".equals(args.getString("mode"))) {
          writeSnapshot(context, args.getString("snapshot"));
          Class<?> migration =
              Class.forName(
                  "com.aido.mobile.widget.LegacyWidgetSnapshotMigration",
                  true,
                  context.getClassLoader());
          Object migrator = migration.getField("INSTANCE").get(null);
          Method migrate = migration.getMethod("migrate", Context.class);
          Class<?> storage =
              Class.forName("expo.modules.widgets.WidgetsStorage", true, context.getClassLoader());
          Object sdkStorage = storage.getField("INSTANCE").get(null);
          Method set = storage.getMethod("set", Context.class, String.class, String.class);
          for (int round = 0; round < 50; round++) {
            SharedPreferences.Editor clear = sdk.edit();
            for (String name : names) clear.remove("__expo_widgets_" + name + "_props");
            clear.commit();
            final java.util.concurrent.atomic.AtomicReference<Throwable> failure =
                new java.util.concurrent.atomic.AtomicReference<>();
            Thread oldWriter =
                new Thread(
                    () -> {
                      try {
                        migrate.invoke(migrator, context);
                      } catch (Throwable e) {
                        failure.set(e);
                      }
                    });
            Thread newWriter =
                new Thread(
                    () -> {
                      try {
                        for (String name : names)
                          set.invoke(
                              sdkStorage,
                              context,
                              "__expo_widgets_" + name + "_props",
                              freshProps(args.getString("props"), name));
                      } catch (Throwable e) {
                        failure.set(e);
                      }
                    });
            oldWriter.start();
            newWriter.start();
            oldWriter.join();
            newWriter.join();
            if (failure.get() != null) throw new IllegalStateException(failure.get());
            for (String name : names)
              if (!"new-account"
                  .equals(
                      new JSONObject(sdk.getString("__expo_widgets_" + name + "_props", null))
                          .getString("marker")))
                throw new IllegalStateException("Account overwrite race " + round + " " + name);
          }
          report.put("raceIterations", 50);
        }
        if ("reload".equals(args.getString("mode"))) {
          Class<?> updater =
              Class.forName("expo.modules.widgets.WidgetsUpdater", true, context.getClassLoader());
          Object instance = updater.getField("INSTANCE").get(null);
          Method reload = updater.getMethod("reload", Context.class, String.class);
          for (String name : names) {
            sdk.edit()
                .putString(
                    "__expo_widgets_" + name + "_props", freshProps(args.getString("props"), name))
                .commit();
            reload.invoke(instance, context, name);
          }
        }
        for (String name : names) {
          int id = qa.getInt(name, -1);
          ComponentName component =
              new ComponentName(
                  context.getPackageName(), context.getPackageName() + ".widget." + name);
          AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
          if (info == null || !component.equals(info.provider))
            throw new IllegalStateException("Widget identity lost " + name + " " + id);
          if (!"reload".equals(args.getString("mode")))
            context.sendBroadcast(
                new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .setComponent(component)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[] {id}));
          report.put(
              name,
              new JSONObject().put("id", id).put("provider", info.provider.flattenToString()));
        }
        for (int i = 0; i < 200; i++) {
          boolean ready = true;
          for (String name : names) ready &= sdk.contains("__expo_widgets_" + name + "_props");
          if (ready) break;
          Thread.sleep(50);
        }
        for (String name : names) {
          String props = sdk.getString("__expo_widgets_" + name + "_props", null);
          if (props == null) throw new IllegalStateException("Snapshot missing " + name);
          report.getJSONObject(name).put("props", new JSONObject(props));
        }
        AppWidgetHost host = new AppWidgetHost(context, 5810);
        host.startListening();
        try {
          for (String name : names) {
            final int id = qa.getInt(name, -1);
            JSONObject props = report.getJSONObject(name).getJSONObject("props");
            String today =
                new java.text.SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
            boolean stale =
                !"loggedOut".equals(props.getString("state"))
                    && !today.equals(props.getString("date"));
            String expected =
                stale
                    ? props.getString("staleTitle")
                    : !"data".equals(props.getString("state"))
                        ? props.getString("stateTitle")
                        : name.equals("AidoTodaySummary")
                            ? String.valueOf(props.getInt("completedTodos"))
                            : props.getJSONArray("topTodos").getJSONObject(0).getString("title");
            List<String> captured = new ArrayList<>();
            long deadline = android.os.SystemClock.elapsedRealtime() + 20000;
            do {
              captured.clear();
              final List<String> texts = captured;
              runOnMainSync(
                  () -> {
                    AppWidgetHostView view =
                        host.createView(context, id, manager.getAppWidgetInfo(id));
                    collect(view, texts);
                  });
              if (captured.contains(expected)) break;
              Thread.sleep(50);
            } while (android.os.SystemClock.elapsedRealtime() < deadline);
            if (!captured.contains(expected))
              throw new IllegalStateException("Widget render timed out: " + name + " " + captured);
            report.getJSONObject(name).put("views", new JSONArray(captured));
          }
        } finally {
          host.stopListening();
        }
      }
      result.putString("report", report.toString());
      finish(Activity.RESULT_OK, result);
    } catch (Throwable error) {
      result.putString("error", error.toString());
      finish(Activity.RESULT_CANCELED, result);
    }
  }

  private static String freshProps(String raw, String name) throws Exception {
    JSONObject props = new JSONObject(raw);
    props.put("marker", "new-account");
    props.put(
        "maxRows", name.equals("AidoTodaySummary") ? 0 : name.equals("AidoTodayList") ? 3 : 8);
    return props.toString();
  }

  private static void collect(View view, List<String> texts) {
    if (view instanceof TextView) texts.add(((TextView) view).getText().toString());
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) collect(group.getChildAt(i), texts);
    }
  }

  private void writeSnapshot(Context context, String raw) throws Exception {
    ClassLoader loader = context.getClassLoader();
    Class<?> mmkv = Class.forName("com.tencent.mmkv.MMKV", true, loader);
    mmkv.getMethod("initialize", Context.class, String.class)
        .invoke(null, context, context.getFilesDir().getAbsolutePath() + "/mmkv");
    Object storage =
        mmkv.getMethod("mmkvWithID", String.class, int.class).invoke(null, "widget-storage", 1);
    try {
      Object success =
          mmkv.getMethod("encode", String.class, String.class)
              .invoke(storage, "aido_widget_snapshot_v1", raw);
      if (!Boolean.TRUE.equals(success)) throw new IllegalStateException("MMKV encode failed");
    } finally {
      mmkv.getMethod("close").invoke(storage);
    }
  }
}
