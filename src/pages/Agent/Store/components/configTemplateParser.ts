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

  // 2. 替换单变量（含空串，避免可选字段残留 {{.VAR}}）
  const simpleVars = vars.filter((v): v is SimpleVar => v.type === 'simple');
  for (const sv of simpleVars) {
    const regex = new RegExp(`\\{\\{\\.${sv.key}\\}\\}`, 'g');
    result = result.replace(regex, sv.value ?? '');
  }

  return result;
}

/** 去掉行尾注释与包裹引号 */
function stripYamlScalar(raw: string): string {
  let s = raw.trim();
  // 行尾 # 注释（不在引号内时粗略处理）
  if (!/^['"]/.test(s)) {
    const hashIdx = s.indexOf(' #');
    if (hashIdx >= 0) s = s.slice(0, hashIdx).trim();
  } else {
    // 带引号：取完整引号串
    const q = s[0];
    const end = s.indexOf(q, 1);
    if (end > 0) return s.slice(1, end);
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

interface YamlLine {
  indent: number;
  key: string;
  value: string | null; // null = 纯容器/列表项起始
  isListItem: boolean;
  raw: string;
}

function parseYamlLines(text: string): YamlLine[] {
  const result: YamlLine[] = [];
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = raw.search(/\S/);
    const content = raw.slice(indent);

    // 列表项: - key: value 或 - value
    if (content.startsWith('- ')) {
      const after = content.slice(2).trim();
      const kv = after.match(/^([\w.@-]+)\s*:\s*(.*)$/);
      if (kv) {
        result.push({
          indent,
          key: kv[1],
          value: kv[2].trim() === '' ? null : stripYamlScalar(kv[2]),
          isListItem: true,
          raw,
        });
      } else {
        result.push({
          indent,
          key: '',
          value: stripYamlScalar(after),
          isListItem: true,
          raw,
        });
      }
      continue;
    }

    const kv = content.match(/^([\w.@-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    result.push({
      indent,
      key: kv[1],
      value: val === '' ? null : stripYamlScalar(val),
      isListItem: false,
      raw,
    });
  }
  return result;
}

/** 根据缩进栈，为每一行计算完整路径（列表项用 [] 标记） */
function buildPathMap(lines: YamlLine[]): { path: string; line: YamlLine; index: number }[] {
  const stack: { indent: number; key: string }[] = [];
  const mapped: { path: string; line: YamlLine; index: number }[] = [];

  lines.forEach((line, index) => {
    while (stack.length > 0 && stack[stack.length - 1].indent >= line.indent) {
      stack.pop();
    }

    if (line.isListItem) {
      const parentPath = stack.map(s => s.key).join('.');
      const listKey = line.key || '_';
      const path = parentPath ? `${parentPath}[].${listKey}` : `[].${listKey}`;
      mapped.push({ path, line, index });
      if (line.key && line.value === null) {
        stack.push({ indent: line.indent, key: `${line.key}` });
      }
      return;
    }

    const parentPath = stack.map(s => s.key).join('.');
    const path = parentPath ? `${parentPath}.${line.key}` : line.key;
    mapped.push({ path, line, index });

    if (line.value === null) {
      stack.push({ indent: line.indent, key: line.key });
    }
  });

  return mapped;
}

/** 在导入配置中按 YAML 路径取值 */
function getValueByPath(importedMap: { path: string; line: YamlLine }[], path: string): string | undefined {
  const hit = importedMap.find(m => m.path === path && m.line.value !== null);
  return hit?.line.value ?? undefined;
}

/** 从模板行中提取 {{.Var}} 所在键的路径信息 */
function findSimpleVarPath(template: string, varKey: string): string | null {
  // 去掉 range 块，避免块内字段干扰
  const withoutRange = template.replace(/\{\{range\s+\.\w+\}\}[\s\S]*?\{\{end\}\}/g, '');
  const placeholder = `{{.${varKey}}}`;
  const pos = withoutRange.indexOf(placeholder);
  if (pos < 0) return null;

  const lineStart = withoutRange.lastIndexOf('\n', pos) + 1;
  const lineEnd = withoutRange.indexOf('\n', pos);
  const lineText = withoutRange.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const kv = lineText.trim().match(/^([\w.@-]+)\s*:/);
  if (!kv) return null;

  // 用「占位符替换成空值」后的文本建路径，保证缩进栈正确
  const synthetic = withoutRange.replace(
    new RegExp(`\\{\\{\\.${varKey}\\}\\}`, 'g'),
    ''
  );
  const lines = parseYamlLines(synthetic);
  const mapped = buildPathMap(lines);
  // 找 key 匹配且路径以该 key 结尾的行；优先精确匹配含变量的那一行
  const candidates = mapped.filter(m => m.line.key === kv[1] && m.path.endsWith(kv[1]));
  // 用原始模板行内容辅助：合成文本中对应行 value 为空（被替换掉）
  const emptyVal = candidates.find(m => m.line.value === '' || m.line.value === null);
  if (emptyVal) return emptyVal.path;
  return candidates[0]?.path ?? null;
}

/** 提取 range 块在模板中的父路径（range 上一层的 key 路径） */
function findRangeParentPath(template: string, arrayKey: string): string | null {
  const rangeRegex = new RegExp(`\\{\\{range\\s+\\.${arrayKey}\\}\\}`);
  const match = rangeRegex.exec(template);
  if (!match) return null;

  const before = template.slice(0, match.index);
  // 找 range 前最近的、缩进更浅的容器键
  const linesBefore = before.split('\n');
  let rangeIndent = 0;
  for (let i = linesBefore.length - 1; i >= 0; i--) {
    const t = linesBefore[i].trim();
    if (!t) continue;
    rangeIndent = linesBefore[i].search(/\S/);
    break;
  }

  // 用去掉所有 range 后的文档建路径，找 indent < rangeIndent 的最近容器
  const withoutRange = template.replace(/\{\{range\s+\.\w+\}\}[\s\S]*?\{\{end\}\}/g, '');
  const lines = parseYamlLines(withoutRange);
  const mapped = buildPathMap(lines);

  // 简化：在原始模板中找 range 前一行的 key 路径
  for (let i = linesBefore.length - 1; i >= 0; i--) {
    const raw = linesBefore[i];
    const t = raw.trim();
    if (!t || t.startsWith('#') || t.startsWith('{{')) continue;
    const indent = raw.search(/\S/);
    if (indent > rangeIndent) continue;
    const kv = t.match(/^([\w.@-]+)\s*:/);
    if (!kv) continue;
    // 在 mapped 中找同名路径（取最后一个匹配的浅层键）
    const hits = mapped.filter(m => m.line.key === kv[1] && m.line.value === null);
    if (hits.length > 0) return hits[hits.length - 1].path;
    return kv[1];
  }
  return arrayKey;
}

/** 从导入配置中提取 range 数组项 */
function extractArrayItems(
  imported: string,
  parentPath: string | null,
  fields: ArrayField[]
): Record<string, string>[] {
  const lines = parseYamlLines(imported);
  const mapped = buildPathMap(lines);
  const fieldKeys = new Set(fields.map(f => f.key));

  // 找属于 parentPath[] 下的列表字段
  const prefix = parentPath ? `${parentPath}[]` : '[]';
  const listEntries = mapped.filter(m => m.path.startsWith(prefix + '.') || m.path === prefix);

  // 按连续列表项分组：同一列表项内的字段 indent 相近
  const items: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  let currentItemIndent = -1;

  for (const entry of listEntries) {
    const { line } = entry;
    if (!line.key || !fieldKeys.has(line.key)) continue;

    if (line.isListItem) {
      // 新列表项起始
      if (current && Object.keys(current).length > 0) items.push(current);
      current = createEmptyItem(fields);
      current[line.key] = line.value ?? '';
      currentItemIndent = line.indent;
    } else if (current && line.indent > currentItemIndent) {
      current[line.key] = line.value ?? '';
    } else {
      // 非列表结构：把同路径下匹配字段当作单行对象累积
      if (!current) current = createEmptyItem(fields);
      current[line.key] = line.value ?? '';
    }
  }
  if (current && Object.values(current).some(v => v !== '')) {
    items.push(current);
  }

  // 若无列表语法，尝试按字段路径扁平提取单条
  if (items.length === 0) {
    const item = createEmptyItem(fields);
    let any = false;
    for (const f of fields) {
      const path = parentPath ? `${parentPath}.${f.key}` : f.key;
      const val = getValueByPath(mapped, path);
      if (val !== undefined) {
        item[f.key] = val;
        any = true;
      }
    }
    if (any) items.push(item);
  }

  return items.length > 0 ? items : [createEmptyItem(fields)];
}

export interface ExtractResult {
  vars: TemplateVar[];
  matched: number;
  unmatched: string[];
}

/**
 * 根据配置模板，从导入的 YAML 中反解析变量值
 * 最终安装仍应使用 renderConfigTemplate，保证结构与模板一致
 */
export function extractVarsFromConfig(
  template: string,
  imported: string,
  existingVars: TemplateVar[]
): ExtractResult {
  const baseVars = existingVars.length > 0 ? existingVars : parseConfigTemplate(template);
  const importedLines = parseYamlLines(imported);
  const importedMap = buildPathMap(importedLines);

  let matched = 0;
  const unmatched: string[] = [];

  const vars: TemplateVar[] = baseVars.map(v => {
    if (v.type === 'simple') {
      const path = findSimpleVarPath(template, v.key);
      const value = path ? getValueByPath(importedMap, path) : undefined;
      if (value !== undefined) {
        matched += 1;
        return { ...v, value };
      }
      unmatched.push(v.key);
      return { ...v, value: '' };
    }

    // array
    const parentPath = findRangeParentPath(template, v.key);
    const items = extractArrayItems(imported, parentPath, v.fields);
    const filled = items.some(item => Object.values(item).some(val => val !== ''));
    if (filled) {
      matched += 1;
      return { ...v, items };
    }
    unmatched.push(v.key);
    return { ...v, items: [createEmptyItem(v.fields)] };
  });

  return { vars, matched, unmatched };
}
