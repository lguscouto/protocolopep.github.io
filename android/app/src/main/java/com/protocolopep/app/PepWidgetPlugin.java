package com.protocolopep.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PepWidget")
public class PepWidgetPlugin extends Plugin {

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PepWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            int taken = call.getInt("takenCount", 0);
            int total = call.getInt("totalCount", 0);
            int pct = call.getInt("progressPct", 0);
            String status = call.getString("statusText", "Nenhum protocolo hoje");
            String sub = call.getString("subText", "Abra o app para configurar");
            boolean discrete = Boolean.TRUE.equals(call.getBoolean("discreteMode", false));

            editor.putInt(PepWidgetProvider.KEY_TAKEN, taken);
            editor.putInt(PepWidgetProvider.KEY_TOTAL, total);
            editor.putInt(PepWidgetProvider.KEY_PCT, pct);
            editor.putString(PepWidgetProvider.KEY_STATUS, status);
            editor.putString(PepWidgetProvider.KEY_SUB, sub);
            editor.putBoolean("discreteMode", discrete);
            editor.apply();

            // Atualiza os widgets na tela inicial
            PepWidgetProvider.updateAllWidgets(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erro ao atualizar widget nativo: " + e.getMessage());
        }
    }
}
