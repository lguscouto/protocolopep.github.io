package com.protocolopep.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PepWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
