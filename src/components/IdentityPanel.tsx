import type { LifecycleEntry } from './lifecycle';

interface IdentityPanelProps {
  log: LifecycleEntry[];
  onClear: () => void;
}

/**
 * 挂载/卸载流水：由真实 RowItem 的 useEffect 上报。
 * 重排（同 key）不会产生任何记录；换 key 会看到“旧 key 卸载 → 新 key 挂载”一对记录。
 */
export function IdentityPanel({ log, onClear }: IdentityPanelProps) {
  return (
    <section className="panel" aria-label="节点身份流水">
      <header className="panel-head">
        <h2>④ 节点身份（挂载 / 卸载流水）</h2>
        <div className="toolbar">
          <button type="button" onClick={onClear}>
            清空流水
          </button>
        </div>
      </header>
      <p className="sub-hint">
        只有重挂载才会出现记录。重排同 key 行时这里应当静默——这正是状态得以保留的原因。
      </p>
      {log.length === 0 ? (
        <p className="empty-hint">暂无挂载/卸载事件。</p>
      ) : (
        <ol className="log-list">
          {log.map((e) => (
            <li key={e.seq} className={`log-entry log-entry--${e.kind}`} data-testid={`lc-${e.seq}`}>
              <span className="log-kind">{e.kind === 'mount' ? '挂载' : '卸载'}</span>
              <span className="log-key">key={e.key}</span>
              <span className="log-uid">实例 {e.uid}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
