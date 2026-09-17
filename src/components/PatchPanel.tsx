import type { Plan } from '../reconciler/types';
import { describeOp } from '../lib';

interface PatchPanelProps {
  plan: Plan | null;
  stepIndex: number;
  onStep(): void;
  onRunAll(): void;
  onClose(): void;
}

/** 右下：一次更新的补丁步骤，可单步 / 全部执行 / 放弃 */
export function PatchPanel({ plan, stepIndex, onStep, onRunAll, onClose }: PatchPanelProps) {
  const done = plan !== null && stepIndex >= plan.ops.length;

  return (
    <section className="panel patch">
      <h2>③ 补丁步骤</h2>
      {!plan ? (
        <p className="hint">在左侧编辑草稿树，点击「生成补丁」，这里会列出一次更新的全部补丁步骤。</p>
      ) : (
        <>
          {plan.warnings.map((w) => (
            <p className="warning" key={w}>{w}</p>
          ))}
          <p className="progress">{`已执行 ${stepIndex} / ${plan.ops.length} 步`}</p>
          <ol className="ops">
            {plan.ops.map((op, i) => (
              <li key={i} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'pending'}>
                <code className={`op-tag op-${op.type}`}>{op.type}</code>
                <span>{describeOp(op)}</span>
              </li>
            ))}
            {plan.ops.length === 0 && <li className="done">无补丁步骤：草稿与当前渲染一致。</li>}
          </ol>
          <div className="toolbar">
            <button onClick={onStep} disabled={done}>单步执行</button>
            <button onClick={onRunAll} disabled={done}>全部执行</button>
            <button onClick={onClose}>{plan.ops.length === 0 ? '关闭' : '放弃补丁'}</button>
          </div>
        </>
      )}
    </section>
  );
}
