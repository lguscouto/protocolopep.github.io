package com.protocolopep.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.graphics.Canvas;
import android.graphics.pdf.PdfDocument;
import android.provider.MediaStore;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "PepFileExport")
public class PepFileExportPlugin extends Plugin {

    private JSObject persistPdf(File source, String fileName, String subDir) throws Exception {
        Context context = getContext();
        String relativePath = Environment.DIRECTORY_DOWNLOADS + "/" + subDir + "/";
        String displayPath = "Downloads/" + subDir + "/" + fileName;
        Uri resultUri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            resultUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (resultUri == null) throw new Exception("Não foi possível criar o PDF no armazenamento.");
            try (FileInputStream input = new FileInputStream(source); OutputStream output = resolver.openOutputStream(resultUri)) {
                if (output == null) throw new Exception("Não foi possível gravar o PDF.");
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(resultUri, values, null, null);
        } else {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File targetDir = new File(downloadsDir, subDir);
            if (!targetDir.exists() && !targetDir.mkdirs()) throw new Exception("Não foi possível criar a pasta de destino.");
            File target = new File(targetDir, fileName);
            try (FileInputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            resultUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", target);
        }
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("path", displayPath);
        result.put("uri", resultUri.toString());
        return result;
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        String fileName = call.getString("fileName");
        String html = call.getString("html");
        String subDir = call.getString("subDir", "ProtocoloPEP");
        if (fileName == null || fileName.trim().isEmpty() || html == null) {
            call.reject("Nome e conteúdo HTML são obrigatórios.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            WebView webView = new WebView(getContext());
            webView.getSettings().setJavaScriptEnabled(false);
            webView.setWebViewClient(new WebViewClient() {
                private boolean started = false;
                @Override public void onPageFinished(WebView view, String url) {
                    if (started) return;
                    started = true;
                    view.postDelayed(() -> {
                        PdfDocument document = new PdfDocument();
                        File temp = new File(getContext().getCacheDir(), "pep-report-" + System.currentTimeMillis() + ".pdf");
                        try {
                            final int pageWidth = 595;
                            final int pageHeight = 842;
                            final int margin = 32;
                            final int webWidth = 1080;
                            view.measure(View.MeasureSpec.makeMeasureSpec(webWidth, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
                            view.layout(0, 0, webWidth, Math.max(1, view.getMeasuredHeight()));
                            float scale = (float) (pageWidth - (margin * 2)) / webWidth;
                            int sliceHeight = Math.max(1, (int) ((pageHeight - (margin * 2)) / scale));
                            int pageCount = Math.max(1, (int) Math.ceil((double) view.getHeight() / sliceHeight));
                            for (int index = 0; index < pageCount; index++) {
                                PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, index + 1).create();
                                PdfDocument.Page page = document.startPage(info);
                                Canvas canvas = page.getCanvas();
                                canvas.clipRect(margin, margin, pageWidth - margin, pageHeight - margin);
                                canvas.translate(margin, margin - (index * sliceHeight * scale));
                                canvas.scale(scale, scale);
                                view.draw(canvas);
                                document.finishPage(page);
                            }
                            try (FileOutputStream output = new FileOutputStream(temp)) { document.writeTo(output); }
                            JSObject result = persistPdf(temp, fileName, subDir);
                            call.resolve(result);
                        } catch (Exception error) {
                            call.reject("Erro ao gerar PDF: " + error.getMessage());
                        } finally {
                            document.close();
                            temp.delete();
                            view.destroy();
                        }
                    }, 300);
                }
            });
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void shareSavedFile(PluginCall call) {
        String uriValue = call.getString("uri");
        String mimeType = call.getString("mimeType", "application/pdf");
        String title = call.getString("title", "Compartilhar arquivo");
        if (uriValue == null || uriValue.trim().isEmpty()) { call.reject("URI do arquivo é obrigatório."); return; }
        try {
            Uri uri = Uri.parse(uriValue);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(intent, title);
            if (getActivity() != null) getActivity().startActivity(chooser); else getContext().startActivity(chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Erro ao compartilhar arquivo salvo: " + error.getMessage());
        }
    }

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
