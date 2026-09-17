import type { ItemData, PatchStep } from './types';
import { applyStep } from './reconcile';

/**
 * 一轮补丁的执行历史。
 * 每个快照记录“执行到第几步”以及当时的真实列表；
 * 撤销/重做就是在快照间切换——被卸载的实例 id 与新挂载的 id 都能原样找回，
 * 因此右侧行组件在撤销时能按 key 恢复到与之前完全相同的身份对应关系。
 */
export interface HistoryState {
  /** 当前已执行的步骤数（0..steps.length） */
  applied: number;
  /** applied 每一档对应的真实列表快照 */
  snapshots: ItemData[][];
}

function shot(items: readonly ItemData[]): ItemData[] {
  return items.map((it) => ({ ...it }));
}

export function initHistory(initial: readonly ItemData[]): HistoryState {
  return { applied: 0, snapshots: [shot(initial)] };
}

/** 规划好新补丁后进入下一轮：以当前列表为第 0 档快照 */
export function beginRound(current: readonly ItemData[]): HistoryState {
  return { applied: 0, snapshots: [shot(current)] };
}

/** 执行下一步；已全部执行时原样返回 */
export function stepForward(history: HistoryState, steps: readonly PatchStep[]): HistoryState {
  if (history.applied >= steps.length) return history;
  const current = history.snapshots[history.applied];
  const next = applyStep(current, steps[history.applied]);
  const snapshots = history.snapshots.slice(0, history.applied + 1);
  snapshots.push(next);
  return { applied: history.applied + 1, snapshots };
}

/** 撤销一步 */
export function stepBackward(history: HistoryState): HistoryState {
  if (history.applied <= 0) return history;
  return { ...history, applied: history.applied - 1 };
}

/** 一次执行完剩余步骤 */
export function runAll(history: HistoryState, steps: readonly PatchStep[]): HistoryState {
  let h = history;
  while (h.applied < steps.length) h = stepForward(h, steps);
  return h;
}

/** 回退到本轮补丁开始前 */
export function resetRound(history: HistoryState): HistoryState {
  if (history.applied === 0) return history;
  return { ...history, applied: 0 };
}

export function currentItems(history: HistoryState): ItemData[] {
  return history.snapshots[history.applied];
}
