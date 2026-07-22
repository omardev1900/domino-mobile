import * as Haptics from 'expo-haptics';
import SettingsManager from '../SettingsManager';

const HapticManager = {
    triggerImpact: () => {
        if (!SettingsManager.getSettings().isVibrationEnabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },

    triggerSuccess: () => {
        if (!SettingsManager.getSettings().isVibrationEnabled) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },

    triggerError: () => {
        if (!SettingsManager.getSettings().isVibrationEnabled) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },

    triggerLightSelection: () => {
        if (!SettingsManager.getSettings().isVibrationEnabled) return;
        Haptics.selectionAsync();
    },
};

export default HapticManager;
