import type { InstanceState, Plan, ReconcilerState, SpecItem } from './reconciler/types';
import { computePlan } from './reconciler/diff';
import { applyAll, applyOp } from './reconciler/apply';

/** 一次已提交更新的快照，用于撤销/重做 */
export interface Snapshot {
  committed: ReconcilerState;
  spec: SpecItem[];
}

export interface AppState {
  /** 当前真实渲染的实例列表（右侧界面由它驱动） */
  committed: ReconcilerState;
  /** 与 committed 对应的 spec */
  committedSpec: SpecItem[];
  /** 左侧正在编辑的草稿（下一次渲染的目标） */
  draft: SpecItem[];
  /** 已生成、正在执行的补丁计划 */
  plan: Plan | null;
  /** 生成补丁时的 committed 快照，放弃补丁时回滚到这里 */
  planBase: ReconcilerState | null;
  /** 已执行的补丁步数 */
  stepIndex: number;
  past: Snapshot[];
  future: Snapshot[];
  selectedId: number | null;
}

export const initialSpec: SpecItem[] = [
  { key: 'alpha', kind: 'input', label: '输入框 Alpha' },
  { key: 'beta', kind: 'counter', label: '计数器 Beta' },
  { key: 'gamma', kind: 'collapsible', label: '折叠行 Gamma' },
  { key: 'delta', kind: 'input', label: '输入框 Delta' },
];

export function createInitialState(): AppState {
  // 初始渲染也走一遍 mount 补丁，和后续更新同一条代码路径
  const committed = applyAll({ instances: [], nextId: 1 }, computePlan([], initialSpec).ops);
  return {
    committed,
    committedSpec: initialSpec,
    draft: initialSpec,
    plan: null,
    planBase: null,
    stepIndex: 0,
    past: [],
    future: [],
    selectedId: null,
  };
}

export type Action =
  | { type: 'draft'; draft: SpecItem[] }
  | { type: 'generate' }
  | { type: 'step' }
  | { type: 'runAll' }
  | { type: 'closePlan' }
  | { type: 'setInstanceState'; instanceId: number; state: InstanceState }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; instanceId: number | null }
  | { type: 'reset' };

/** 补丁全部执行完毕：提交为新基线，旧基线进入撤销栈 */
function commit(state: AppState, committed: ReconcilerState): AppState {
  return {
    ...state,
    committed,
    committedSpec: state.draft,
    plan: null,
    planBase: null,
    stepIndex: 0,
    past: [...state.past, { committed: state.planBase ?? state.committed, spec: state.committedSpec }],
    future: [],
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'draft': {
      if (state.plan) return state; // 补丁执行期间锁定草稿
      return { ...state, draft: action.draft };
    }
    case 'generate': {
      if (state.plan) return state;
      const plan = computePlan(state.committed.instances, state.draft);
      return { ...state, plan, planBase: state.committed, stepIndex: 0 };
    }
    case 'step': {
      const { plan } = state;
      if (!plan || state.stepIndex >= plan.ops.length) return state;
      const committed = applyOp(state.committed, plan.ops[state.stepIndex]);
      const stepIndex = state.stepIndex + 1;
      if (stepIndex === plan.ops.length) return commit({ ...state, stepIndex }, committed);
      return { ...state, committed, stepIndex };
    }
    case 'runAll': {
      const { plan } = state;
      if (!plan || plan.ops.length === 0) return state;
      const committed = applyAll(state.committed, plan.ops.slice(state.stepIndex));
      return commit(state, committed);
    }
    case 'closePlan': {
      if (!state.plan) return state;
      // 未执行完的补丁整体回滚到生成时的快照
      return { ...state, committed: state.planBase ?? state.committed, plan: null, planBase: null, stepIndex: 0 };
    }
    case 'setInstanceState': {
      const instances = state.committed.instances.map((inst) =>
        inst.instanceId === action.instanceId ? { ...inst, state: action.state } : inst,
      );
      return { ...state, committed: { ...state.committed, instances } };
    }
    case 'undo': {
      if (state.plan || state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        committed: prev.committed,
        committedSpec: prev.spec,
        draft: prev.spec,
        past: state.past.slice(0, -1),
        future: [{ committed: state.committed, spec: state.committedSpec }, ...state.future],
      };
    }
    case 'redo': {
      if (state.plan || state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        committed: next.committed,
        committedSpec: next.spec,
        draft: next.spec,
        past: [...state.past, { committed: state.committed, spec: state.committedSpec }],
        future: rest,
      };
    }
    case 'select':
      return { ...state, selectedId: action.instanceId };
    case 'reset':
      return createInitialState();
  }
}
