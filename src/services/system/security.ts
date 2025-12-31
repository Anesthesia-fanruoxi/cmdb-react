/**
 * 安全配置相关 API
 */

import { apiClient } from '../request';

// 获取IP黑名单列表
export const getBlacklist = () => 
  apiClient.get('/system/blacklist/list');

// 添加IP到黑名单
export const addToBlacklist = (data: { ip: string }) => 
  apiClient.post('/system/blacklist/add', data);

// 从黑名单中移除IP
export const removeFromBlacklist = (data: { ip: string }) => 
  apiClient.post('/system/blacklist/remove', data);

// 获取安全配置
export const getSecurityConfig = () => 
  apiClient.get('/system/security/list');

// 更新安全配置
export const updateSecurityConfig = (data: {
  blacklist_count: number;
  blacklist_lock: number;
  ratelimit_cd: number;
  ratelimit_ttl: number;
}) => apiClient.post('/system/security/update', data);
