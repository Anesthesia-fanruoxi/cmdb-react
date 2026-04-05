/**
 * BI 查询执行 Hook
 */

import { useState } from 'react';
import { executeDatabiQuery } from '@/services/sql/databi';
import { toast } from '@/components/AppNotification';

export const useDatabiQuery = () => {
  const [queryLoading, setQueryLoading] = useState(false);
  const [resultData, setResultData] = useState<unknown[][]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [took, setTook] = useState(0);

  // 执行查询
  const executeQuery = async (project: string, sql: string) => {
    const trimmedSql = sql.trim();
    if (!trimmedSql) {
      toast.warning('请输入SQL查询语句');
      return { resultData: [], resultColumns: [], took: 0 };
    }

    if (!project) {
      toast.warning('请先选择项目');
      return { resultData: [], resultColumns: [], took: 0 };
    }

    setQueryLoading(true);
    setResultData([]);
    setResultColumns([]);
    setTook(0);

    try {
      const startTime = Date.now();
      const res = await executeDatabiQuery({
        project,
        context: trimmedSql,
        type: 'sql'
      });

      if (res.code === 200 && res.data) {
        const { head, table } = res.data;
        let columns: string[] = [];
        let data: unknown[][] = [];

        if (head && head.length > 0) {
          columns = head;
          setResultColumns(head);
        }

        if (table && table.length > 0) {
          const firstRow = table[0];
          if (Array.isArray(firstRow)) {
            // 二维数组格式，转换为对象数组
            const convertedData = table.map((row: any[]) => {
              const obj: Record<string, any> = {};
              head.forEach((col: string, index: number) => {
                obj[col] = row[index];
              });
              return obj;
            });
            data = convertedData as any;
            setResultData(convertedData as any);
          } else {
            // 已经是对象数组格式
            data = table;
            setResultData(table);
          }
        }

        const elapsedTime = Date.now() - startTime;
        setTook(elapsedTime);
        
        return { resultData: data, resultColumns: columns, took: elapsedTime };
      } else {
        toast.error(res.message || '查询失败');
        return { resultData: [], resultColumns: [], took: 0 };
      }
    } catch (error) {
      console.error('查询失败:', error);
      toast.error('查询失败');
      return { resultData: [], resultColumns: [], took: 0 };
    } finally {
      setQueryLoading(false);
    }
  };

  // 复制整列
  const handleCopyColumn = (colIndex: number) => {
    const col = resultColumns[colIndex];
    const values = resultData.map(row => {
      const value = typeof row === 'object' && !Array.isArray(row)
        ? row[col]
        : row[colIndex];
      return String(value ?? '');
    });
    
    navigator.clipboard.writeText(values.join('\n')).then(() => {
      toast.success('已复制整列数据');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  // 复制整行（JSON 格式）
  const handleCopyRow = (rowIndex: number) => {
    const row = resultData[rowIndex];
    const rowObject: Record<string, any> = {};
    
    resultColumns.forEach((col, colIndex) => {
      const value = typeof row === 'object' && !Array.isArray(row)
        ? row[col]
        : row[colIndex];
      rowObject[col] = value;
    });
    
    const jsonString = JSON.stringify(rowObject, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
      toast.success('已复制整行数据（JSON 格式）');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  // 清空结果
  const clearResults = () => {
    setResultData([]);
    setResultColumns([]);
    setTook(0);
  };

  return {
    queryLoading,
    resultData,
    resultColumns,
    took,
    executeQuery,
    handleCopyColumn,
    handleCopyRow,
    clearResults
  };
};
