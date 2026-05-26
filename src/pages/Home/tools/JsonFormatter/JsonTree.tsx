/**
 * JSON 树形渲染组件
 * 支持折叠/展开、元素数量统计
 */
import { useState } from 'react';
import './JsonTree.css';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface JsonNodeProps {
  value: JsonValue;
  keyName?: string;
  depth: number;
  isLast: boolean;
}

/** 获取值的类型标签 */
function getTypeClass(value: JsonValue): string {
  if (value === null) return 'jt-null';
  if (typeof value === 'boolean') return 'jt-bool';
  if (typeof value === 'number') return 'jt-number';
  if (typeof value === 'string') return 'jt-string';
  return '';
}

/** 格式化基础值显示 */
function formatPrimitive(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/** 折叠时的摘要：显示前几个 key 或元素 */
function CollapsedSummary({ value }: { value: JsonValue[] | Record<string, JsonValue> }) {
  if (Array.isArray(value)) {
    return (
      <span className="jt-summary">
        <span className="jt-bracket">[</span>
        <span className="jt-count">{value.length} 项</span>
        <span className="jt-bracket">]</span>
      </span>
    );
  }
  const keys = Object.keys(value);
  const preview = keys.slice(0, 3).join(', ');
  return (
    <span className="jt-summary">
      <span className="jt-bracket">{'{'}</span>
      <span className="jt-count">{keys.length} 项</span>
      {keys.length > 0 && <span className="jt-preview"> · {preview}{keys.length > 3 ? '...' : ''}</span>}
      <span className="jt-bracket">{'}'}</span>
    </span>
  );
}

function JsonNode({ value, keyName, depth, isLast }: JsonNodeProps) {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const [collapsed, setCollapsed] = useState(depth >= 2); // 深度 >= 2 默认折叠

  const comma = isLast ? '' : ',';

  // 基础类型
  if (!isObject) {
    return (
      <div className="jt-line">
        {keyName !== undefined && (
          <span className="jt-key">"{keyName}": </span>
        )}
        <span className={getTypeClass(value)}>{formatPrimitive(value)}</span>
        <span className="jt-comma">{comma}</span>
      </div>
    );
  }

  const entries = isArray
    ? (value as JsonValue[]).map((v, i) => ({ k: String(i), v, isLast: i === (value as JsonValue[]).length - 1 }))
    : Object.entries(value as Record<string, JsonValue>).map(([k, v], i, arr) => ({ k, v, isLast: i === arr.length - 1 }));

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';
  const count = entries.length;

  return (
    <div className="jt-node">
      {/* 行头：key + 折叠按钮 + 括号，右键触发折叠 */}
      <div className="jt-line jt-collapsible" onContextMenu={() => { setCollapsed(c => !c); }}>
        <span className={`jt-toggle ${collapsed ? 'jt-toggle--collapsed' : ''}`}>▾</span>
        {keyName !== undefined && (
          <span className="jt-key">"{keyName}": </span>
        )}
        {collapsed ? (
          <>
            <CollapsedSummary value={value as JsonValue[] | Record<string, JsonValue>} />
            <span className="jt-comma">{comma}</span>
          </>
        ) : (
          <>
            <span className="jt-bracket">{openBracket}</span>
            <span className="jt-inline-count">{count} 项</span>
          </>
        )}
      </div>

      {/* 展开内容 */}
      {!collapsed && (
        <>
          <div className="jt-children">
            {entries.map(({ k, v, isLast: last }) => (
              <JsonNode
                key={k}
                value={v}
                keyName={isArray ? undefined : k}
                depth={depth + 1}
                isLast={last}
              />
            ))}
          </div>
          <div className="jt-line jt-close-line" onContextMenu={e => { e.preventDefault(); setCollapsed(true); }}>
            <span className="jt-bracket">{closeBracket}</span>
            <span className="jt-comma">{comma}</span>
          </div>
        </>
      )}
    </div>
  );
}

interface JsonTreeProps {
  data: JsonValue;
}

export default function JsonTree({ data }: JsonTreeProps) {
  return (
    <div className="jt-root">
      <JsonNode value={data} depth={0} isLast={true} />
    </div>
  );
}
