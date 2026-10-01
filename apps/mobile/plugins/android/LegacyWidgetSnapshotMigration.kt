package __ANDROID_PACKAGE__.widget

import android.content.Context
import com.tencent.mmkv.MMKV
import com.tencent.mmkv.MMKVLogLevel
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

internal object LegacyWidgetSnapshotMigration {
  private val widgetRows =
    mapOf("AidoTodaySummary" to 0, "AidoTodayList" to 3, "AidoTodayLarge" to 8)

  fun migrate(context: Context) {
    val preferences = context.getSharedPreferences("expo.modules.widgets", Context.MODE_PRIVATE)
    if (widgetRows.keys.all { preferences.contains(propsKey(it)) }) return
    val legacyFile = File(context.filesDir, "mmkv/widget-storage")
    val legacySizes =
      context.getSharedPreferences("${context.packageName}.WIDGET_SIZES", Context.MODE_PRIVATE)
    if (!legacyFile.isFile && legacySizes.all.isEmpty()) return

    val props =
      runCatching {
          val root = File(context.filesDir, "mmkv").absolutePath
          MMKV.initialize(context, root, MMKVLogLevel.LevelNone)
          val storage =
            MMKV.mmkvWithID("widget-storage", MMKV.SINGLE_PROCESS_MODE or MMKV.READ_ONLY_MODE)
          try {
            storage.decodeString("aido_widget_snapshot_v1")?.let { toProps(JSONObject(it)) }
          } finally {
            storage.close()
          }
        }
        .getOrNull()

    // The SDK uses the same preference lock for writes, so account updates always win.
    synchronized(preferences) {
      val editor = preferences.edit()
      widgetRows.forEach { (name, maxRows) ->
        if (!preferences.contains(propsKey(name))) {
          val migrated = props?.let { JSONObject(it.toString()) } ?: staleProps(context, name)
          if (migrated != null) {
            migrated.put("maxRows", maxRows)
            editor.putString(propsKey(name), migrated.toString())
          }
        }
      }
      editor.commit()
    }
  }

  internal fun toProps(snapshot: JSONObject): JSONObject {
    for (key in
      listOf("version", "totalTodos", "completedTodos", "completionRate", "currentStreak")) {
      require(snapshot.get(key) is Number)
    }
    for (key in listOf("state", "date")) require(snapshot.get(key) is String)
    require(snapshot.get("isComplete") is Boolean)
    require(snapshot.getDouble("version") == 1.0)
    val state = snapshot.getString("state")
    require(state in setOf("data", "empty", "loggedOut"))
    val date = snapshot.getString("date")
    require(Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date))
    val totalTodos = snapshot.getInt("totalTodos")
    val completedTodos = snapshot.getInt("completedTodos")
    val completionRate = snapshot.getDouble("completionRate")
    val currentStreak = snapshot.getInt("currentStreak")
    for (key in listOf("totalTodos", "completedTodos", "currentStreak")) {
      require(snapshot.getDouble(key) == snapshot.getInt(key).toDouble())
    }
    require(totalTodos >= 0 && completedTodos >= 0 && completedTodos <= totalTodos)
    require(completionRate.isFinite() && completionRate in 0.0..100.0 && currentStreak >= 0)
    val strings = snapshot.getJSONObject("strings")
    val todos = snapshot.getJSONArray("topTodos")
    require(todos.length() <= 10)
    val topTodos = JSONArray()
    for (index in 0 until todos.length()) {
      val todo = todos.getJSONObject(index)
      require(
        todo.get("title") is String &&
          todo.get("completed") is Boolean &&
          todo.get("categoryColor") is String
      )
      val color = todo.getString("categoryColor")
      topTodos.put(
        JSONObject().apply {
          put("title", todo.getString("title"))
          put("completed", todo.getBoolean("completed"))
          put("color", if (Regex("^#[0-9a-fA-F]{6}$").matches(color)) color else "#FF6B43")
        }
      )
    }
    return JSONObject().apply {
      put("state", state)
      put("date", date)
      put("opensApp", true)
      put("maxRows", 8)
      put("totalTodos", totalTodos)
      put("completedTodos", completedTodos)
      put("completionRate", completionRate)
      put("isComplete", snapshot.getBoolean("isComplete"))
      put("currentStreak", currentStreak)
      put("topTodos", topTodos)
      for (key in
        listOf(
          "progressTitle",
          "percentLabel",
          "streakLabel",
          "allDoneLabel",
          "moreLabelTemplate",
          "staleTitle",
          "staleCta",
        )) {
        require(strings.get(key) is String)
        put(key, strings.getString(key))
      }
      if (strings.has("compactStreakLabel")) require(strings.get("compactStreakLabel") is String)
      put(
        "compactStreakLabel",
        if (strings.has("compactStreakLabel")) strings.getString("compactStreakLabel")
        else strings.getString("streakLabel"),
      )
      val prefix = if (state == "loggedOut") "loggedOut" else "empty"
      require(strings.get("${prefix}Title") is String && strings.get("${prefix}Cta") is String)
      put("stateTitle", strings.getString("${prefix}Title"))
      put("stateCta", strings.getString("${prefix}Cta"))
    }
  }

  private fun staleProps(context: Context, name: String): JSONObject? =
    runCatching {
        val resource =
          context.resources.getIdentifier(
            "expo_widgets_layout_registry",
            "raw",
            context.packageName,
          )
        context.resources.openRawResource(resource).bufferedReader().use { reader ->
          val props =
            JSONObject(reader.readText())
              .getJSONObject("widgets")
              .getJSONObject(name)
              .getJSONObject("initialProps")
          props.put("state", "stale")
          props.put("stateTitle", props.getString("staleTitle"))
          props.put("stateCta", props.getString("staleCta"))
          props
        }
      }
      .getOrNull()

  private fun propsKey(name: String) = "__expo_widgets_${name}_props"
}
