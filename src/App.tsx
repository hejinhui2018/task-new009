import { useCallback, useMemo, useRef, useState } from 'react';
import type { ItemData, ReconcilePlan } from './core/types';
import { createDemoItems } from './core/factory';
import {
  type DraftItem,
  appendRow,
  fromItems,
  insertDuplicateKeyRow,
  insertRowAt,
  makeRow,
  moveRow,
  removeRow,
  reverseRows,
  cycleKey,
  updateRow,
} from './core/draft';
import { reconcile } from './core/reconcile';
import {
  type HistoryState,
  beginRound,
  currentItems,
  initHistory,
  resetRound,
  runAll,
  stepBackward,
  stepForward,
} from './core/history';
import type { LifecycleEntry } from './components/lifecycle';
import { LifecycleContext } from './components/lifecycle';
import { DraftEditor } from './components/DraftEditor';
import { PatchPanel } from './components/PatchPanel';
import { ResultPanel } from './components/ResultPanel';
import { IdentityPanel } from './components/IdentityPanel';

const EMPTY_PLAN: ReconcilePlan = { steps: [], warnings: [], expectedNext: [] };

function uniqueKey(rows: readonly DraftItem[]): string {
  const used = new Set(rows.map((r) => r.key));
  let n = rows.length + 1;
  let key = `n${n}`;
  while (used.has(key)) {
    n += 1;
    key = `n${n}`;
  }
  return key;
}

export default function App() {
  const [demo] = useState<ItemData[]>(() => createDemoItems());
  // 真实列表的唯一事实来源：history 当前档快照；RowItem 的内部状态由 React 按 key 自行持有
  const [history, setHistory] = useState<HistoryState>(() => initHistory(createDemoItems()));
  const [rows, setRows] = useState<DraftItem[]>(() => fromItems(demo));
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [log, setLog] = useState<LifecycleEntry[]>([]);
  const seqRef = useRef(0);

  // 真实 RowItem 挂载/卸载时上报（useEffect 清理函数 → 卸载）
  const reportLifecycle = useCallback((entry: Omit<LifecycleEntry, 'seq'>) => {
    seqRef.current += 1;
    setLog((prev) => [...prev, { ...entry, seq: seqRef.current }]);
  }, []);

  const shownItems = currentItems(history);
  const shownItemsRef = useRef(shownItems);
  shownItemsRef.current = shownItems;

  /** 任何草稿修改都使旧补丁作废，需要基于当前真实列表重新规划 */
  const invalidatePlan = useCallback(() => setPlan(EMPTY_PLAN), []);

  const editRows = useCallback(
    (fn: (rows: DraftItem[]) => DraftItem[]) => {
      setRows((prev) => fn(prev));
      invalidatePlan();
    },
    [invalidatePlan],
  );

  const handlePlan = useCallback(() => {
    const base = shownItemsRef.current;
    setPlan(reconcile(base, rows));
    setHistory(beginRound(base));
  }, [rows]);

  const handleForward = useCallback(
    () => setHistory((h) => stepForward(h, plan.steps)),
    [plan.steps],
  );
  const handleBackward = useCallback(() => setHistory((h) => stepBackward(h)), []);
  const handleRunAll = useCallback(() => setHistory((h) => runAll(h, plan.steps)), [plan.steps]);
  const handleResetRound = useCallback(() => setHistory((h) => resetRound(h)), []);

  const handleResetDemo = useCallback(() => {
    const fresh = createDemoItems();
    setHistory(initHistory(fresh));
    setRows(fromItems(fresh));
    setPlan(EMPTY_PLAN);
    setLog([]);
  }, []);

  const handlers = useMemo(
    () => ({
      onChangeKey: (rowId: string, value: string) => editRows((rs) => updateRow(rs, rowId, { key: value })),
      onChangeLabel: (rowId: string, value: string) => editRows((rs) => updateRow(rs, rowId, { label: value })),
      onChangeSeed: (rowId: string, value: string) => editRows((rs) => updateRow(rs, rowId, { seedText: value })),
      onMove: (rowId: string, dir: -1 | 1) => editRows((rs) => moveRow(rs, rowId, dir)),
      onRemove: (rowId: string) => editRows((rs) => removeRow(rs, rowId)),
      onDuplicateKey: (rowId: string) => editRows((rs) => insertDuplicateKeyRow(rs, rowId)),
      onCycleKey: (rowId: string) => editRows((rs) => cycleKey(rs, rowId)),
      onInsertAfter: (rowId: string) =>
        editRows((rs) => {
          const i = rs.findIndex((r) => r.rowId === rowId);
          const key = uniqueKey(rs);
          return insertRowAt(rs, i + 1, makeRow({ key, label: `新项目(${key})`, seedText: `${key} 的初始值` }));
        }),
      onReverse: () => editRows((rs) => reverseRows(rs)),
      onAppend: () =>
        editRows((rs) => {
          const key = uniqueKey(rs);
          return appendRow(rs, makeRow({ key, label: `新项目(${key})`, seedText: '新插入的初始值' }));
        }),
    }),
    [editRows],
  );

  const lastStep = history.applied > 0 ? plan.steps[history.applied - 1] ?? null : null;

  return (
    <LifecycleContext.Provider value={reportLifecycle}>
      <div className="app">
        <header className="app-header">
          <h1>列表协调升级验收台</h1>
          <p>
            验证重排 / 插入 / 删除 / 切换 key 后，组件的<strong>输入框、计数器、折叠态</strong>等内部状态是否被
            React 交给了正确的实例。左侧描述目标树，右侧是真实 React 渲染结果与逐步补丁。
          </p>
        </header>

        <div className="app-grid">
          <DraftEditor rows={rows} {...handlers} onResetDemo={handleResetDemo} onPlan={handlePlan} />

          <div className="right-col">
            <PatchPanel
              steps={plan.steps}
              warnings={plan.warnings}
              applied={history.applied}
              onForward={handleForward}
              onBackward={handleBackward}
              onRunAll={handleRunAll}
              onReset={handleResetRound}
            />
            <ResultPanel
              items={shownItems}
              lastStep={lastStep}
              expectedNext={plan.expectedNext}
              allDone={plan.steps.length > 0 && history.applied === plan.steps.length}
            />
            <IdentityPanel log={log} onClear={() => setLog([])} />
          </div>
        </div>
      </div>
    </LifecycleContext.Provider>
  );
}
