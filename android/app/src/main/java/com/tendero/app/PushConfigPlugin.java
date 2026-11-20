package com.tendero.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Dice a la app si se compiló con google-services.json. Sin ese archivo el plugin de Gradle
// no genera el recurso google_app_id, Firebase no arranca y las notificaciones push quedan apagadas.
@CapacitorPlugin(name = "PushConfig")
public class PushConfigPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("firebase", id != 0);
        call.resolve(result);
    }
}
