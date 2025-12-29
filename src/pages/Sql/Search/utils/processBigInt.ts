/**
 * 大整数处理工具函数
 * 将超出 JavaScript 安全整数范围的数字转换为字符串
 */

/**
 * 递归处理数据中的大整数，将其转换为字符串
 * @param data 需要处理的数据
 * @returns 处理后的数据
 */
export function processBigInt(data: unknown): unknown {
  // 处理 null 和 undefined
  if (data === null || data === undefined) {
    return data;
  }

  // 处理数字类型
  if (typeof data === 'number') {
    // 检查是否超出安全整数范围
    if (!Number.isFinite(data)) {
      return data;
    }
    if (Number.isInteger(data) && !Number.isSafeInteger(data)) {
      return String(data);
    }
    return data;
  }

  // 处理字符串类型 - 直接返回
  if (typeof data === 'string') {
    return data;
  }

  // 处理数组类型 - 递归处理每个元素
  if (Array.isArray(data)) {
    return data.map(item => processBigInt(item));
  }

  // 处理对象类型 - 递归处理每个属性
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(data as Record<string, unknown>)) {
      result[key] = processBigInt((data as Record<string, unknown>)[key]);
    }
    return result;
  }

  // 其他类型直接返回
  return data;
}

export default processBigInt;
