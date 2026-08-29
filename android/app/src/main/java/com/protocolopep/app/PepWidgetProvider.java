package com.protocolopep.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

public class PepWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "PepWidgetPrefs";
    public static final String KEY_TAKEN = "takenCount";
    public static final String KEY_TOTAL = "totalCount";
    public static final String KEY_PCT = "progressPct";
    public static final String KEY_STATUS = "statusText";
    public static final String KEY_SUB = "subText";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int taken = prefs.getInt(KEY_TAKEN, 0);
        int total = prefs.getInt(KEY_TOTAL, 0);
        int pct = prefs.getInt(KEY_PCT, 0);
        String status = prefs.getString(KEY_STATUS, "Nenhum protocolo hoje");
        String sub = prefs.getString(KEY_SUB, "Abra o app para configurar");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.pep_widget);
        views.setTextViewText(R.id.widget_status_text, status);
        views.setTextViewText(R.id.widget_sub_text, sub);
        views.setTextViewText(R.id.widget_badge_pct, pct + "%");
        views.setProgressBar(R.id.widget_progress_bar, 100, pct, false);

        // Ao clicar no widget, abre o app
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAllWidgets(Context context) {
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, PepWidgetProvider.class);
            int[] allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
            if (allWidgetIds != null && allWidgetIds.length > 0) {
                for (int widgetId : allWidgetIds) {
                    updateAppWidget(context, appWidgetManager, widgetId);
                }
            }
        } catch (Exception e) {
            android.util.Log.w("PepWidgetProvider", "Erro ao atualizar widgets: " + e.getMessage());
        }
    }
}
