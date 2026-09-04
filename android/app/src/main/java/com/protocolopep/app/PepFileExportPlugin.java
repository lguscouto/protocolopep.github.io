package com.protocolopep.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "PepFileExport")
public class PepFileExportPlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/json");
        String subDir = call.getString("subDir", "ProtocoloPEP");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("O parâmetro fileName é obrigatório.");
            return;
        }
        if (content == null) {
            call.reject("O parâmetro content é obrigatório.");
            return;
        }

        try {
            Context context = getContext();
            String relativePath = Environment.DIRECTORY_DOWNLOADS + "/" + subDir + "/";
            String displayPath = "Downloads/" + subDir + "/" + fileName;
            String resultUriString = "";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();

                // Remove versões anteriores com o mesmo nome para evitar arquivos duplicados com sufixo (1)
                try {
                    Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    String selection = MediaStore.MediaColumns.DISPLAY_NAME + " = ? AND " +
                                       MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?";
                    String[] selectionArgs = new String[]{fileName, "%" + subDir + "%"};
                    resolver.delete(collection, selection, selectionArgs);
                } catch (Exception ignored) {
                    // Se não conseguir deletar versão prévia, o MediaStore criará uma nova versão
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Não foi possível registrar o arquivo no armazenamento do sistema.");
                    return;
                }

                try (OutputStream os = resolver.openOutputStream(uri)) {
                    if (os == null) {
                        call.reject("Falha ao abrir fluxo de escrita do arquivo.");
                        return;
                    }
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }

                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);

                resultUriString = uri.toString();
            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File targetDir = new File(downloadsDir, subDir);
                if (!targetDir.exists()) {
                    targetDir.mkdirs();
                }

                File targetFile = new File(targetDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }

                MediaScannerConnection.scanFile(
                    context,
                    new String[]{targetFile.getAbsolutePath()},
                    new String[]{mimeType},
                    null
                );

                resultUriString = Uri.fromFile(targetFile).toString();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", displayPath);
            ret.put("uri", resultUriString);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erro ao exportar arquivo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/json");
        String title = call.getString("title", "Compartilhar arquivo");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("O parâmetro fileName é obrigatório.");
            return;
        }
        if (content == null) {
            call.reject("O parâmetro content é obrigatório.");
            return;
        }

        try {
            Context context = getContext();
            File cacheDir = new File(context.getCacheDir(), "exports");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }

            File tempFile = new File(cacheDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }

            String authority = context.getPackageName() + ".fileprovider";
            Uri contentUri = FileProvider.getUriForFile(context, authority, tempFile);

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (getActivity() != null) {
                getActivity().startActivity(chooser);
            } else {
                context.startActivity(chooser);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erro ao compartilhar arquivo: " + e.getMessage());
        }
    }
}
