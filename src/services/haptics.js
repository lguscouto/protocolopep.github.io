import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

class HapticsService {
  async light() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}
    } else if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  async medium() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
    } else if (navigator.vibrate) {
      navigator.vibrate(40);
    }
  }

  async success() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch (e) {}
    } else if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }

  async error() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Error });
      } catch (e) {}
    } else if (navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }
  }
}

export const haptics = new HapticsService();
