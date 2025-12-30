/**
 * 文件管理 API
 */

import { apiClient } from '../request';

/** 项目信息 */
export interface FileProject {
  project: string;
  project_name: string;
}

/** 文件信息 */
export interface FileItem {
  name: string;
  is_dir: boolean;
  size: number;
  mod_time: string;
  url?: string;
}

/** 文件列表参数 */
export interface FileListParams {
  project: string;
  key: string;
  path?: string;
  search?: string;
  sort?: 'name' | 'time' | 'size';
  page?: number;
}

// 获取项目列表
export function getFileProjects() {
  return apiClient.get<{ items: FileProject[] }>('/assets/file/projects');
}

// 获取文件列表
export function getFileList(params: FileListParams) {
  return apiClient.get<{ data: { files: FileItem[]; total: number; page: number } }>('/assets/file/list', params as unknown as Record<string, unknown>);
}

// 上传文件
export function uploadFile(formData: FormData) {
  return apiClient.upload('/assets/file/upload', formData);
}
