import type { Instance, ReconcilerState, SpecItem } from '../src/reconciler/types';
import { computePlan } from '../src/reconciler/diff';
import { applyAll } from '../src/reconciler/apply';

/** 从空列表开始，用 mount 补丁构建初始实例列表（与应用同一条代码路径） */
export function stateFromSpec(spec: SpecItem[]): ReconcilerState {
  return applyAll({ instances: [], nextId: 1 }, computePlan([], spec).ops);
}

export function keysOf(state: ReconcilerState): string[] {
  return state.instances.map((i) => i.key);
}

export function byKey(state: ReconcilerState, key: string): Instance | undefined {
  return state.instances.find((i) => i.key === key);
}
