/**
 * 文件管理 API
 */

import { apiClient } from '../request';
import type { ApiResponse } from '../../types/api';

/** 文件项 */
export interface FileItem {
  id?: number;
  uuid?: string;
  filename: string;
  download_url?: string;
  file_size: number;
  size_str: string;
  category: string;
  resource: string;
  create_by?: string;
  created_at: string;
  is_private?: boolean;
}

/** 生成私有下载链接响应 */
export interface GenerateLinkResponse {
  download_url: string;
  download_key: string;
  expire_in: number;
  expire_at: string;
}

/** 分类大小 */
export interface CategorySize {
  size: number;
  size_str: string;
}

/** 文件列表响应 */
export interface FileListResponse {
  list: FileItem[];
  total: number;
  total_size: number;
  total_size_str: string;
  category_sizes: Record<string, CategorySize>;
}

/** 获取公有文件列表 */
export function getPublicFiles(params?: { page?: number; page_size?: number }): Promise<ApiResponse<FileListResponse>> {
  return apiClient.get<FileListResponse>('/knowledge/file/public/list', params);
}

/** 获取私有文件列表 */
export function getPrivateFiles(params?: { page?: number; page_size?: number }): Promise<ApiResponse<FileListResponse>> {
  return apiClient.get<FileListResponse>('/knowledge/file/private/list', params);
}

/** 删除文件 */
export function deleteFile(id: number): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/knowledge/file/delete?id=${id}`);
}

/** 生成私有文件下载链接 */
export function generateDownloadLink(uuid: string): Promise<ApiResponse<GenerateLinkResponse>> {
  return apiClient.post<GenerateLinkResponse>('/file/download/generate', { uuid });
}

/** 上传文件 */
export function uploadFile(formData: FormData): Promise<ApiResponse<FileItem>> {
  return apiClient.upload<FileItem>('/file/upload', formData);
}
