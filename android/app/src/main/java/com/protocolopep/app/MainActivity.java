package com.protocolopep.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private Insets latestSystemInsets;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PepWidgetPlugin.class);
        registerPlugin(PepHealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
        configureWindowInsets();
    }

    /**
     * Capacitor 6 does not expose the reliable CSS safe-area variables that are
     * needed by Android edge-to-edge layouts. Publish the real system-bar and
     * cutout insets to the document so the web UI can reserve that space.
     */
    private void configureWindowInsets() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        final WebView webView = getBridge().getWebView();

        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView loadedWebView) {
                publishSafeAreaInsets(loadedWebView);
            }
        });

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            latestSystemInsets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            publishSafeAreaInsets(webView);
            return windowInsets;
        });

        ViewCompat.requestApplyInsets(webView);
    }

    private void publishSafeAreaInsets(WebView webView) {
        if (webView == null || latestSystemInsets == null) {
            return;
        }

        float density = webView.getResources().getDisplayMetrics().density;
        if (density <= 0f) {
            density = 1f;
        }

        String script = String.format(
            Locale.US,
            "(function(){var d=document.documentElement;if(!d)return;var s=d.style;s.setProperty('--safe-area-inset-top','%.2fpx');s.setProperty('--safe-area-inset-right','%.2fpx');s.setProperty('--safe-area-inset-bottom','%.2fpx');s.setProperty('--safe-area-inset-left','%.2fpx');})();",
            latestSystemInsets.top / density,
            latestSystemInsets.right / density,
            latestSystemInsets.bottom / density,
            latestSystemInsets.left / density
        );

        webView.evaluateJavascript(script, null);
    }
}
