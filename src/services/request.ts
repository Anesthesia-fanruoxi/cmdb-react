/**
 * HTTP 请求封装
 * 基于 Tauri HTTP 插件实现，支持大整数保护
 */

import { fetch } from '@tauri-apps/plugin-http';
import type { ApiResponse } from '../types/api';
import { getToken, removeToken } from './storage';

// API 基础地址
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 30000;

/**
 * 自定义请求错误类
 */
export class RequestError extends Error {
  code: number;
  details?: string;

  constructor(code: number, message: string, details?: string) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 大整数保护
 * 将超过 15 位的数字转换为字符串，防止精度丢失
 */
function protectBigInt(data: string): unknown {
  if (!data || typeof data !== 'string') {
    return data;
  }

  try {
    // 针对数组中的大整数特殊处理
    let protectedJson = data;
    
    // 匹配数组开头的大整数 [1909446301032554500, ...]
    protectedJson = protectedJson.replace(/\[\s*(\d{15,})\s*,/g, '["$1",');
    
    // 匹配数组中间的大整数 [..., 1909446301032554500, ...]
    protectedJson = protectedJson.replace(/,\s*(\d{15,})\s*(,|\])/g, ',"$1"$2');
    
    // 匹配数组末尾的大整数 [..., 1909446301032554500]
    protectedJson = protectedJson.replace(/,\s*(\d{15,})\s*\]/g, ',"$1"]');
    
    // 匹配对象中的大整数值 "key": 1909446301032554500
    protectedJson = protectedJson.replace(/:\s*(\d{15,})\s*(,|}|\])/g, ':"$1"$2');

    return JSON.parse(protectedJson);
  } catch {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
}

/**
 * 解析 API 响应
 */
export function parseApiResponse<T>(response: unknown): ApiResponse<T> {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('code' in response)
  ) {
    throw new RequestError(
      -1,
      '无效的 API 响应格式',
      'Response must contain code field'
    );
  }

  const apiResponse = response as Record<string, unknown>;
  return {
    code: apiResponse.code as number,
    message: (apiResponse.message || apiResponse.msg || '') as string,
    data: apiResponse.data as T,
  };
}

/**
 * 请求配置
 */
interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob' | 'text';
}

/**
 * 发送 HTTP 请求
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: unknown,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const token = getToken(); // 同步获取 token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout || DEFAULT_TIMEOUT
    );

    const fetchOptions: RequestInit & { signal: AbortSignal } = {
      method,
      headers,
      signal: controller.signal,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(data);
    }

    const response = await fetch(fullUrl, fetchOptions);
    clearTimeout(timeoutId);

    // 处理二进制响应
    if (config.responseType === 'blob') {
      const blob = await response.blob();
      return blob as unknown as ApiResponse<T>;
    }

    // 获取响应文本并应用大整数保护
    const responseText = await response.text();
    const responseData = protectBigInt(responseText);

    // 处理 HTTP 错误状态
    if (!response.ok) {
      const errorData = responseData as { code?: number; message?: string };
      const errorMessage = errorData?.message || getHttpErrorMessage(response.status);
      
      // 处理 401 未授权 - 桌面应用不自动跳转，只清除 token
      if (response.status === 401) {
        removeToken();
        // 桌面应用：不自动跳转，让调用方处理
        throw new RequestError(401, errorMessage || '登录已过期，请重新登录');
      }

      // 处理 403 特殊情况
      if (response.status === 403) {
        if (errorData?.message === '请先绑定双因子认证') {
          window.location.href = '/force-two-factor';
          throw new RequestError(403, errorData.message);
        }
        if (errorData?.message === '请先修改默认密码') {
          window.location.href = '/force-change-password';
          throw new RequestError(403, errorData.message);
        }
        // 其他 403 错误：权限不足，不跳转，只抛出错误
        throw new RequestError(403, errorMessage || '权限不足');
      }

      throw new RequestError(
        errorData?.code || response.status,
        errorMessage
      );
    }

    return parseApiResponse<T>(responseData);
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    // 处理超时
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestError(-1, '请求超时，请稍后重试');
    }

    // 处理网络错误
    throw new RequestError(
      -1,
      '网络异常，请检查网络连接',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 获取 HTTP 错误消息
 */
function getHttpErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权，请重新登录',
    403: '拒绝访问',
    404: '请求的资源不存在',
    408: '请求超时',
    500: '服务器内部错误',
    502: '网关错误',
    503: '服务不可用',
    504: '网关超时',
  };
  return messages[status] || `请求失败 (${status})`;
}

/**
 * API 客户端
 */
export const apiClient = {
  /**
   * GET 请求
   */
  get<T>(url: string, params?: Record<string, unknown>, config?: RequestConfig) {
    const queryString = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${String(v)}`)
          .join('&')
      : '';
    return request<T>('GET', url + queryString, undefined, config);
  },

  /**
   * POST 请求
   */
  post<T>(url: string, data?: unknown, config?: RequestConfig) {
    return request<T>('POST', url, data, config);
  },

  /**
   * PUT 请求
   */
  put<T>(url: string, data?: unknown, config?: RequestConfig) {
    return request<T>('PUT', url, data, config);
  },

  /**
   * DELETE 请求
   */
  delete<T>(url: string, config?: RequestConfig) {
    return request<T>('DELETE', url, undefined, config);
  },

  /**
   * 文件上传
   */
  async upload<T>(url: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const token = getToken();

    const headers: Record<string, string> = { ...config?.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config?.timeout || 300000);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      const responseData = protectBigInt(responseText);

      if (!response.ok) {
        const errorData = responseData as { code?: number; message?: string };
        throw new RequestError(errorData?.code || response.status, errorData?.message || '上传失败');
      }

      return parseApiResponse<T>(responseData);
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError(-1, '上传失败', error instanceof Error ? error.message : String(error));
    }
  },
};

export default apiClient;
