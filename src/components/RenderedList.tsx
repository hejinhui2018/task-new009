import type { Fate, Instance, InstanceState } from '../reconciler/types';
import { colorFor, fateLabels, kindLabels } from '../lib';

interface RenderedListProps {
  instances: Instance[];
  fateById: Record<number, Fate> | null;
  selectedId: number | null;
  onSelect(id: number): void;
  onSetState(id: number, state: InstanceState): void;
}

/**
 * 右侧：真实渲染结果。
 * 渲染的输入就是协调器当前的实例列表——补丁每应用一步，这里就跟着变。
 * 每个组件的局部状态都存在实例上，编辑会写回协调器。
 */
export function RenderedList({ instances, fateById, selectedId, onSelect, onSetState }: RenderedListProps) {
  return (
    <section className="panel rendered">
      <h2>② 渲染结果（由补丁驱动）</h2>
      <ul className="instance-list">
        {instances.map((inst) => {
          const fate = fateById?.[inst.instanceId];
          return (
            <li
              key={inst.instanceId}
              data-testid="committed-row"
              data-key={inst.key}
              className={inst.instanceId === selectedId ? 'selected' : ''}
              onClick={() => onSelect(inst.instanceId)}
            >
              <span className="dot" style={{ background: colorFor(inst.instanceId) }} />
              <span className="iid" data-testid="instance-id">{`#${inst.instanceId}`}</span>
              <span className="kind">{kindLabels[inst.kind]}</span>
              <code className="key">{inst.key}</code>
              <span className="row-label">{inst.label}</span>
              {fate && <span className={`fate fate-${fate}`}>{fateLabels[fate]}</span>}
              <span className="widget">
                <Widget state={inst.state} onSetState={(s) => onSetState(inst.instanceId, s)} />
              </span>
            </li>
          );
        })}
        {instances.length === 0 && <li className="empty-row">（空列表）</li>}
      </ul>
      <p className="hint">点击行可在下方「节点身份」中查看详情；直接在行内输入 / 计数 / 折叠，状态存在实例上。</p>
    </section>
  );
}

function Widget({ state, onSetState }: { state: InstanceState; onSetState(next: InstanceState): void }) {
  switch (state.kind) {
    case 'input': {
      const s = state;
      return (
        <input
          value={s.text}
          placeholder="输入局部状态…"
          onChange={(e) => onSetState({ kind: 'input', text: e.target.value })}
        />
      );
    }
    case 'counter': {
      const s = state;
      return (
        <span className="counter">
          <button aria-label="减少" onClick={() => onSetState({ kind: 'counter', count: s.count - 1 })}>−</button>
          <strong>{s.count}</strong>
          <button aria-label="增加" onClick={() => onSetState({ kind: 'counter', count: s.count + 1 })}>+</button>
        </span>
      );
    }
    case 'collapsible': {
      const s = state;
      return (
        <span className="collapsible">
          <button onClick={() => onSetState({ ...s, collapsed: !s.collapsed })}>
            {s.collapsed ? '▸ 展开' : '▾ 收起'}
          </button>
          {!s.collapsed && (
            <input
              aria-label="备注"
              value={s.note}
              placeholder="展开时的备注…"
              onChange={(e) => onSetState({ ...s, note: e.target.value })}
            />
          )}
        </span>
      );
    }
  }
}
