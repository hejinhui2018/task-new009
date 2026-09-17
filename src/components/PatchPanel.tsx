import type { PatchStep, ReconcileWarning } from '../core/types';

interface PatchPanelProps {
  steps: PatchStep[];
  warnings: ReconcileWarning[];
  applied: number;
  onForward: () => void;
  onBackward: () => void;
  onRunAll: () => void;
  onReset: () => void;
}

const TYPE_LABEL: Record<PatchStep['type'], string> = {
  create: '挂载',
  move: '移动',
  delete: '卸载',
  stay: '保留',
};

export function PatchPanel({ steps, warnings, applied, onForward, onBackward, onRunAll, onReset }: PatchPanelProps) {
  const hasPlan = steps.length > 0;
  const done = applied >= steps.length;

  return (
    <section className="panel" aria-label="补丁步骤">
      <header className="panel-head">
        <h2>② 补丁步骤（{steps.length === 0 ? '尚未规划' : `${applied}/${steps.length}`}）</h2>
        <div className="toolbar">
          <button type="button" onClick={onBackward} disabled={!hasPlan || applied === 0}>
            ↶ 撤销一步
          </button>
          <button type="button" className="primary" onClick={onForward} disabled={!hasPlan || done}>
            单步执行 ↷
          </button>
          <button type="button" onClick={onRunAll} disabled={!hasPlan || done}>
            全部执行
          </button>
          <button type="button" onClick={onReset} disabled={!hasPlan || applied === 0}>
            回到补丁前
          </button>
        </div>
      </header>

      {warnings.length > 0 && (
        <div className="warning-stack">
          {warnings.map((w, i) => (
            <div
              key={i}
              role={w.level === 'info' ? 'status' : 'alert'}
              className={`banner banner-${w.level === 'error' ? 'error' : w.level === 'warn' ? 'warn' : 'info'}`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}

      {!hasPlan ? (
        <p className="empty-hint">在左侧编辑目标树后点击「生成补丁」，这里会列出 React 将执行的 卸载 → 挂载/移动/保留 步骤。</p>
      ) : (
        <ol className="step-list">
          {steps.map((s, i) => {
            const state = i < applied ? 'done' : i === applied ? 'current' : 'todo';
            return (
              <li
              key={`${s.id}-${i}`}
              className={`step step--${s.type}${s.duplicate ? ' step--dup' : ''} step--${state}`}
              data-testid={`step-${i}`}
            >
              <span className="step-index">{i + 1}</span>
              <span className={`step-tag tag-${s.type}`}>{TYPE_LABEL[s.type]}</span>
              <span className="step-detail">{s.detail}</span>
              <span className="step-state">{state === 'done' ? '✓ 已执行' : state === 'current' ? '▶ 下一步' : '待执行'}</span>
            </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
