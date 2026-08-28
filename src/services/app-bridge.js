import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

class AppBridgeService {
  init(modalCloseHandler, tabSwitchHandler) {
    if (Capacitor.isNativePlatform()) {
      // Ocultar splash screen após inicialização suave
      setTimeout(() => {
        SplashScreen.hide().catch(() => {});
      }, 500);

      // Tratamento nativo do Botão Voltar do Android
      App.addListener("backButton", ({ canGoBack }) => {
        // 1. Tentar fechar qualquer modal ou overlay aberto
        if (modalCloseHandler && modalCloseHandler()) {
          return;
        }

        // 2. Se estiver em outra aba, voltar para a aba principal (Hoje)
        if (tabSwitchHandler && tabSwitchHandler()) {
          return;
        }

        // 3. Se estiver na raiz, minimizar/sair
        App.exitApp();
      });
    }
  }
}

export const appBridge = new AppBridgeService();
