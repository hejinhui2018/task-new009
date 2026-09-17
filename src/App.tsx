import { useMemo, useReducer } from 'react';
import { createInitialState, reducer } from './store';
import { TreeEditor } from './components/TreeEditor';
import { RenderedList } from './components/RenderedList';
import { PatchPanel } from './components/PatchPanel';
import { Inspector } from './components/Inspector';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const { committed, committedSpec, draft, plan, stepIndex, past, future, selectedId } = state;

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(committedSpec),
    [draft, committedSpec],
  );

  const selected = committed.instances.find((i) => i.instanceId === selectedId);

  const status = plan
    ? `补丁执行中（${stepIndex}/${plan.ops.length}）`
    : dirty
      ? '草稿有未提交的修改'
      : '草稿与渲染一致';

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>列表更新验收台</h1>
          <p className="subtitle">keyed 协调 · 补丁单步执行 · 节点身份追踪</p>
        </div>
        <div className="header-actions">
          <span className={`status ${plan ? 'busy' : dirty ? 'dirty' : 'clean'}`}>{status}</span>
          <button onClick={() => dispatch({ type: 'undo' })} disabled={plan !== null || past.length === 0}>
            撤销
          </button>
          <button onClick={() => dispatch({ type: 'redo' })} disabled={plan !== null || future.length === 0}>
            重做
          </button>
          <button onClick={() => dispatch({ type: 'reset' })}>重置</button>
        </div>
      </header>

      <main className="layout">
        <TreeEditor
          draft={draft}
          locked={plan !== null}
          fates={plan?.nextFates ?? null}
          dirty={dirty}
          onChange={(next) => dispatch({ type: 'draft', draft: next })}
          onRevert={() => dispatch({ type: 'draft', draft: committedSpec })}
          onGenerate={() => dispatch({ type: 'generate' })}
        />
        <div className="right">
          <RenderedList
            instances={committed.instances}
            fateById={plan?.fateById ?? null}
            selectedId={selectedId}
            onSelect={(id) => dispatch({ type: 'select', instanceId: id })}
            onSetState={(id, s) => dispatch({ type: 'setInstanceState', instanceId: id, state: s })}
          />
          <div className="right-bottom">
            <PatchPanel
              plan={plan}
              stepIndex={stepIndex}
              onStep={() => dispatch({ type: 'step' })}
              onRunAll={() => dispatch({ type: 'runAll' })}
              onClose={() => dispatch({ type: 'closePlan' })}
            />
            <Inspector selectedId={selectedId} instance={selected} />
          </div>
        </div>
      </main>
    </div>
  );
}
