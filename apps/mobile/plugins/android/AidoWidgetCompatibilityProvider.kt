package __ANDROID_PACKAGE__.widget

import android.content.Context
import android.content.Intent
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

open class AidoWidgetCompatibilityProvider(widgetName: String) :
  ExpoWidgetsAppWidgetProvider(widgetName) {
  override fun onReceive(context: Context, intent: Intent) {
    LegacyWidgetSnapshotMigration.migrate(context)
    if (intent.action == "${context.packageName}.WIDGET_CLICK") {
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        context.startActivity(it)
      }
      return
    }
    super.onReceive(context, intent)
  }
}
