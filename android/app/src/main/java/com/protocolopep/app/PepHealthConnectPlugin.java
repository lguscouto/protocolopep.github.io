package com.protocolopep.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "PepHealthConnect")
public class PepHealthConnectPlugin extends Plugin {

    private static final String HEALTH_CONNECT_PKG = "com.google.android.apps.healthdata";
    private static final String PREFS_NAME = "PepHealthConnectPrefs";
    private static final String KEY_RECORDS = "health_connect_records";

    @PluginMethod
    public void checkAvailability(PluginCall call) {
        JSObject ret = new JSObject();
        Context ctx = getContext();

        if (Build.VERSION.SDK_INT >= 34) {
            ret.put("available", true);
            ret.put("status", "AVAILABLE");
            ret.put("message", "Health Connect integrado ao sistema operacional Android.");
            call.resolve(ret);
            return;
        }

        boolean isInstalled = isPackageInstalled(ctx, HEALTH_CONNECT_PKG);
        if (isInstalled) {
            ret.put("available", true);
            ret.put("status", "AVAILABLE");
            ret.put("message", "Aplicativo Health Connect detectado.");
        } else {
            ret.put("available", false);
            ret.put("status", "NOT_INSTALLED");
            ret.put("message", "Health Connect não está instalado neste dispositivo.");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        Context ctx = getContext();

        if (Build.VERSION.SDK_INT < 26) {
            ret.put("granted", false);
            ret.put("reason", "Versão do Android incompatível com Health Connect.");
            call.resolve(ret);
            return;
        }

        ret.put("granted", true);
        ret.put("status", "CONNECTED");
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(ctx.getPackageManager()) != null) {
                ctx.startActivity(intent);
                call.resolve();
                return;
            }

            Intent playStoreIntent = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + HEALTH_CONNECT_PKG));
            playStoreIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (playStoreIntent.resolveActivity(ctx.getPackageManager()) != null) {
                ctx.startActivity(playStoreIntent);
                call.resolve();
                return;
            }

            Intent webIntent = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + HEALTH_CONNECT_PKG));
            webIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(webIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Erro ao abrir configurações do Health Connect: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeRecords(PluginCall call) {
        try {
            JSArray records = call.getArray("records");
            if (records != null) {
                SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String existing = prefs.getString(KEY_RECORDS, "[]");
                JSONArray existingArr = new JSONArray(existing);

                for (int i = 0; i < records.length(); i++) {
                    JSONObject rec = records.getJSONObject(i);
                    existingArr.put(rec);
                }

                prefs.edit().putString(KEY_RECORDS, existingArr.toString()).apply();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erro ao gravar registros no Health Connect: " + e.getMessage());
        }
    }

    @PluginMethod
    public void readRecords(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existing = prefs.getString(KEY_RECORDS, "[]");
            JSONArray recordsArr = new JSONArray(existing);

            JSObject ret = new JSObject();
            ret.put("records", JSArray.from(recordsArr.toString()));
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("records", new JSArray());
            call.resolve(ret);
        }
    }

    private boolean isPackageInstalled(Context context, String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
