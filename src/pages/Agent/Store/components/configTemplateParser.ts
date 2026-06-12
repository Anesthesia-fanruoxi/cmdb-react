/**
 * 配置模板解析与渲染
 * 支持单变量 {{.Var}} 和数组块 {{range .X}}...{{end}}
 */

export interface SimpleVar {
  type: 'simple';
  key: string;
  value: string;
  description: string;
}

export interface ArrayField {
  key: string;
  description: string;
}

export interface ArrayVar {
  type: 'array';
  key: string;
  fields: ArrayField[];
  items: Record<string, string>[];
  description: string;
}

export type TemplateVar = SimpleVar | ArrayVar;

/** 解析配置模板，返回变量列表 */
export function parseConfigTemplate(content: string): TemplateVar[] {
  if (!content) return [];

  const vars: TemplateVar[] = [];
  const seenKeys = new Set<string>();

  // 预先收集 range 块位置和信息
  const rangeRegex = /\{\{range\s+\.(\w+)\}\}([\s\S]*?)\{\{end\}\}/g;
  const rangeBlocks: { start: number; end: number; key: string; fields: ArrayField[]; description: string }[] = [];
  let rangeMatch: RegExpExecArray | null;

  while ((rangeMatch = rangeRegex.exec(content)) !== null) {
    const arrayKey = rangeMatch[1];
    const blockContent = rangeMatch[2];

    const beforeBlock = content.slice(0, rangeMatch.index);
    const lastLine = beforeBlock.split('\n').pop() || '';
    const blockDesc = lastLine.match(/#\s*(.+)/)?.[1]?.trim() || '';

    const fields: ArrayField[] = [];
    const fieldRegex = /\{\{\.(\w+)\}\}/g;
    let fieldMatch: RegExpExecArray | null;
    const fieldSeen = new Set<string>();

    while ((fieldMatch = fieldRegex.exec(blockContent)) !== null) {
      const fieldKey = fieldMatch[1];
      if (fieldSeen.has(fieldKey)) continue;
      fieldSeen.add(fieldKey);
      const lineStart = blockContent.lastIndexOf('\n', fieldMatch.index) + 1;
      const lineEnd = blockContent.indexOf('\n', fieldMatch.index);
      const line = blockContent.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const desc = line.match(/#\s*(.+)/)?.[1]?.trim() || '';
      fields.push({ key: fieldKey, description: desc });
    }

    rangeBlocks.push({ start: rangeMatch.index, end: rangeMatch.index + rangeMatch[0].length, key: arrayKey, fields, description: blockDesc });
  }

  // 按模板中出现顺序提取所有变量（单变量 + range块混合排序）
  const allRegex = /\{\{(range\s+)?\.(\w+)\}\}/g;
  let m: RegExpExecArray | null;

  while ((m = allRegex.exec(content)) !== null) {
    const pos = m.index;
    const isRange = !!m[1];
    const key = m[2];

    if (seenKeys.has(key)) continue;

    if (isRange) {
      // range 块
      const block = rangeBlocks.find(b => b.key === key);
      if (block) {
        seenKeys.add(key);
        vars.push({ type: 'array', key, fields: block.fields, items: [createEmptyItem(block.fields)], description: block.description });
      }
    } else {
      // 跳过 {{end}} 关键字
      if (content.slice(pos).startsWith('{{end')) continue;
      // 跳过 range 块内的变量
      if (rangeBlocks.some(b => pos >= b.start && pos < b.end)) continue;

      seenKeys.add(key);
      const lineStart = content.lastIndexOf('\n', pos) + 1;
      const lineEnd = content.indexOf('\n', pos);
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const desc = line.match(/#\s*(.+)/)?.[1]?.trim() || '';
      vars.push({ type: 'simple', key, value: '', description: desc });
    }
  }

  return vars;
}

/** 创建空数组项 */
export function createEmptyItem(fields: ArrayField[]): Record<string, string> {
  const item: Record<string, string> = {};
  fields.forEach(f => { item[f.key] = ''; });
  return item;
}

/** 渲染模板为最终 YAML */
export function renderConfigTemplate(content: string, vars: TemplateVar[]): string {
  if (!content) return '';
  let result = content;

  // 1. 展开 range 块
  const arrayVars = vars.filter((v): v is ArrayVar => v.type === 'array');
  for (const av of arrayVars) {
    const rangeRegex = new RegExp(
      `\\{\\{range\\s+\\.${av.key}\\}\\}([\\s\\S]*?)\\{\\{end\\}\\}`,
      'g'
    );
    result = result.replace(rangeRegex, (_match, blockTpl: string) => {
      if (av.items.length === 0) return '';
      return av.items.map(item => {
        let rendered = blockTpl;
        for (const [field, value] of Object.entries(item)) {
          const fieldRegex = new RegExp(`\\{\\{\\.${field}\\}\\}`, 'g');
          rendered = rendered.replace(fieldRegex, value || '');
        }
        return rendered;
      }).join('');
    });
  }

  // 2. 替换单变量
  const simpleVars = vars.filter((v): v is SimpleVar => v.type === 'simple');
  for (const sv of simpleVars) {
    if (sv.value) {
      const regex = new RegExp(`\\{\\{\\.${sv.key}\\}\\}`, 'g');
      result = result.replace(regex, sv.value);
    }
  }

  return result;
}
