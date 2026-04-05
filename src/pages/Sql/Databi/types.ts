/**
 * BI 查询页面类型定义
 */

import type { DatabiColumnResponse } from '@/services/sql/databi';

/** 树节点类型 */
export interface TreeNode {
  id: string;
  label: string;
  type: 'database' | 'table';
  database?: string;
  table?: string;
  children?: TreeNode[];
}

/** 右键菜单状态 */
export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}

/** 字段详情弹框状态 */
export interface ColumnDialogState {
  visible: boolean;
  loading: boolean;
  saving: boolean;
  tableName: string;
  columns: Array<DatabiColumnResponse & { originalComment: string }>;
  originalColumns: Array<DatabiColumnResponse & { originalComment: string }>;
  editingField: string | null;
}

/** CSV 导入弹框状态 */
export interface CsvDialogState {
  visible: boolean;
  loading: boolean;
  saving: boolean;
  dbName: string;
  tableName: string;
  matched: Array<{ col_name: string; oldComment: string; newComment: string }>;
  unmatched: string[];
  total: number;
  fileName: string;
}

/** CSV 数据行 */
export interface CsvRow {
  col_name: string;
  comment: string;
}

/** 标签页类型 */
export interface DatabiTab {
  id: string;
  name: string;
  project: string;
  sqlQuery: string;
  queryLoading: boolean;
  resultData: unknown[][];
  resultColumns: string[];
  took: number;
  editorHeightPercent: number;
}
