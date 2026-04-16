/**
 * 安全组 API
 */

import { apiClient } from '../request';

export interface SecurityGroupRule {
  security_group_rule_id?: string;
  direction: string;
  ip_protocol: string;
  port_range: string;
  source_cidr_ip: string;
  dest_cidr_ip?: string;
  policy: string;
  priority: number;
  description?: string;
  create_time?: string;
}

export interface SecurityGroupInfo {
  security_group_id: string;
  security_group_name: string;
  region_id: string;
  vpc_id: string;
  ingress_rules: SecurityGroupRule[];
  egress_rules: SecurityGroupRule[];
}

export interface AddRuleParams {
  ip_protocol: string;
  port_range: string;
  source_cidr_ip: string;
  policy?: string;
  priority?: string;
  description?: string;
}

export interface UpdateRuleParams {
  security_group_rule_id: string;
  ip_protocol?: string;
  port_range?: string;
  source_cidr_ip?: string;
  policy?: string;
  priority?: string;
  description?: string;
}

export interface DeleteRuleParams {
  security_group_rule_id: string;
}

// 查询安全组规则列表
export function getSecurityGroupList() {
  return apiClient.get<SecurityGroupInfo>('/assets/securityGroup/list');
}

// 添加入站规则
export function addSecurityGroupRule(params: AddRuleParams) {
  return apiClient.post('/assets/securityGroup/add', params);
}

// 修改入站规则
export function updateSecurityGroupRule(params: UpdateRuleParams) {
  return apiClient.post('/assets/securityGroup/update', params);
}

// 删除入站规则
export function deleteSecurityGroupRule(params: DeleteRuleParams) {
  return apiClient.post('/assets/securityGroup/del', params);
}
