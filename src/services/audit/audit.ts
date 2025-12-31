/**
 * 审计相关 API
 */

import { apiClient } from '../request';

// 获取ES查询日志 (POST)
export const getSearchLog = (params: Record<string, unknown>) => 
  apiClient.post('/audit/search/list', params);

// 获取ES查询日志详情 (POST)
export const getSearchDetail = (params: { query_id: string }) => 
  apiClient.post('/audit/search/detail', params);

// 获取SQL查询日志 (POST)
export const getSqlLog = (params: Record<string, unknown>) => 
  apiClient.post('/audit/sql/list', params);

// 获取SQL查询日志详情 (POST)
export const getSqlDetail = (params: { query_id: string }) => 
  apiClient.post('/audit/sql/detail', params);

// 获取审计分析数据 (GET)
export const getAuditAnalysis = (params: { start_time: string; end_time: string }) => 
  apiClient.get('/audit/analysis', params);

// 获取SQL小时用户统计 (POST)
export const getSqlHourlyUserStats = (params: Record<string, unknown>) => 
  apiClient.post('/audit/sql/user/stats', params);

// 获取ES小时用户统计 (POST)
export const getEsHourlyUserStats = (params: Record<string, unknown>) => 
  apiClient.post('/audit/es/user/stats', params);

// 获取SQL用户小时列表 (POST)
export const getSqlUserHourlyList = (params: Record<string, unknown>) => 
  apiClient.post('/audit/sql/user/list', params);

// 获取ES用户小时列表 (POST)
export const getEsUserHourlyList = (params: Record<string, unknown>) => 
  apiClient.post('/audit/es/user/list', params);

// 获取加解密审计日志 (GET)
export const getKeyAuditLog = (params: Record<string, unknown>) => 
  apiClient.get('/audit/key/list', params);
