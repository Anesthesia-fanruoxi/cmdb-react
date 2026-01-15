/**
 * 弹框栈管理器
 * 用于管理多层弹框的 ESC 键响应
 */

let dialogStack: string[] = [];

export const dialogStackManager = {
  /**
   * 注册弹框
   */
  push(id: string) {
    if (!dialogStack.includes(id)) {
      dialogStack.push(id);
    }
  },

  /**
   * 移除弹框
   */
  pop(id: string) {
    dialogStack = dialogStack.filter(item => item !== id);
  },

  /**
   * 检查是否是最顶层弹框
   */
  isTop(id: string): boolean {
    return dialogStack.length > 0 && dialogStack[dialogStack.length - 1] === id;
  },

  /**
   * 获取栈大小
   */
  size(): number {
    return dialogStack.length;
  }
};
