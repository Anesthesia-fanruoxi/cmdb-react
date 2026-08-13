/**
 * 域名解析管理 API
 */

import { apiClient } from '../request';

/** 项目（用户可访问） */
export interface DomainMapProject {
  project: string;
  project_name: string;
}

/** 主域名选项 */
export interface DomainOption {
  name: string;
  /** 域名归属方 */
  owner?: string;
}

/** 已生成的 nginx 配置文件 */
export interface DomainMapFile {
  domain: string;
  path: string;
  created_at: string;
}

/** SSH reload 节点结果 */
export interface ReloadResult {
  name: string;
  host: string;
  status: string;
  error: string;
}

/** 添加域名解析结果 */
export interface AddDomainMapResult {
  server_name: string;
  sub_domain: string;
  domain: string;
  dns_record_id: string;
  output_file: string;
  reload_results: ReloadResult[];
}

/** 删除域名解析结果 */
export interface DeleteDomainMapResult {
  server_name: string;
  filename: string;
  dns_deleted: boolean;
  reload_results: ReloadResult[];
}

/** nginx 配置预览 */
export interface DomainMapPreview {
  server_name: string;
  output_file: string;
  content: string;
}

const BASE = '/assets/domainMap';

// 1. 可访问项目列表
export const getDomainMapProjects = () =>
  apiClient.get<DomainMapProject[]>(`${BASE}/projects`);

// 2. 主域名下拉
export const getDomainMapOptions = (project: string) =>
  apiClient.get<{ domains: DomainOption[] }>(`${BASE}/options`, { project });

// 3. 添加域名解析
export const addDomainMap = (data: { project: string; sub_domain: string; domain: string }) =>
  apiClient.post<AddDomainMapResult>(`${BASE}/add`, data);

// 4. 预览 nginx 配置
export const previewDomainMap = (project: string, server_name: string) =>
  apiClient.get<DomainMapPreview>(`${BASE}/preview`, { project, server_name });

// 5. 已生成配置列表
export const getDomainMapList = (project: string) =>
  apiClient.get<{ files: DomainMapFile[]; total: number }>(`${BASE}/list`, { project });

// 6. 删除域名解析
export const deleteDomainMap = (project: string, server_name: string) => {
  const qs = `?project=${encodeURIComponent(project)}&server_name=${encodeURIComponent(server_name)}`;
  return apiClient.delete<DeleteDomainMapResult>(`${BASE}/delete${qs}`);
};
