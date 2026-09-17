import { useContext, useEffect, useRef, useState, memo } from 'react';
import type { ItemData } from '../core/types';
import { makeId } from '../core/factory';
import { LifecycleContext } from './lifecycle';

interface RowItemProps {
  item: ItemData;
  position: number;
  /** 当前补丁步骤是否卷入重复 key（仅用于高亮） */
  suspect?: boolean;
}

/**
 * 被验收的真实组件：输入框、计数器、折叠态全部是 React【内部状态】。
 * 列表以 key={item.key} 渲染本组件——重排同 key 行时状态跟随实例，
 * key 变化会重挂载，所有内部状态回到 seedText/初始值。
 */
export const RowItem = memo(function RowItem({ item, position, suspect }: RowItemProps) {
  // 实例身份：挂载瞬间确定，之后任何 re-render / 移动都不变
  const uidRef = useRef<string>('');
  if (uidRef.current === '') uidRef.current = makeId('inst');
  const uid = uidRef.current;

  const report = useContext(LifecycleContext);

  // 真正的局部状态
  const [text, setText] = useState(item.seedText);
  const [count, setCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // 仅在挂载/卸载时上报；换 key 导致的重挂载表现为“旧 key 卸载 + 新 key 挂载”
  const mountKey = item.key;
  useEffect(() => {
    report({ kind: 'mount', key: mountKey, uid });
    return () => report({ kind: 'unmount', key: mountKey, uid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`row-card${suspect ? ' row-card--suspect' : ''}`} data-inst-uid={uid}>
      <div className="row-head">
        <button
          type="button"
          className="collapse-btn"
          aria-label={collapsed ? '展开' : '折叠'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="row-pos">#{position + 1}</span>
        <span className="row-label" title="标题（props）">
          {item.label}
        </span>
        <span className="chip chip-key" title="React 匹配用的 key">
          key={item.key}
        </span>
        <span className="chip chip-engine" title="引擎预测的节点身份">
          引擎 {item.id}
        </span>
        <span className="chip chip-inst" title="React 真实实例身份（挂载瞬间生成）">
          实例 {uid}
        </span>
      </div>

      {!collapsed && (
        <div className="row-body">
          <label className="field">
            <span className="field-name">输入框（内部状态）</span>
            <input value={text} onChange={(e) => setText(e.target.value)} aria-label={`${item.label}的输入框`} />
          </label>
          <div className="count-line">
            <span className="field-name">
              计数器：<strong data-testid={`count-${item.key}`}>{count}</strong>
            </span>
            <button type="button" onClick={() => setCount((c) => c + 1)}>
              +1
            </button>
            <button type="button" onClick={() => setCount((c) => c - 1)}>
              -1
            </button>
          </div>
          <div className="seed-hint">挂载初始值 seedText：「{item.seedText}」——重挂载后输入框会回到这里</div>
        </div>
      )}
    </div>
  );
});
