/**
 * 偏好设置管理器
 * 职责：
 * 1. 管理所有用户偏好（快捷键、监控默认值、界面设置等）的持久化
 * 2. 防抖 3 秒保存
 * 3. 独立保存到 preferences.dat，不影响 states.dat
 * 4. 由 userPrefsStore 内部调用
 */

import { scheduler } from './scheduler';
import { SaveType } from './strategies';
import { useUserPrefsStore } from '@/stores/userPrefsStore';

/**
 * 保存偏好设置（防抖 3 秒，写入 preferences.dat）
 * 由 userPrefsStore 在 setSqlShortcut / setUiPref 等操作后调用
 */
export function savePrefs(): void {
  scheduler.schedule(SaveType.PREFERENCE, () => {
    const prefs = useUserPrefsStore.getState();
    return {
      sqlShortcuts: prefs.sqlShortcuts,
      elfkShortcuts: prefs.elfkShortcuts,
      monitorDefaults: prefs.monitorDefaults,
      esSearchPrefs: prefs.esSearchPrefs,
      uiPrefs: prefs.uiPrefs,
    };
  });
}

/**
 * 强制立即保存偏好（退出登录等场景）
 */
export async function flushPrefs(): Promise<void> {
  await scheduler.flush(SaveType.PREFERENCE);
}
