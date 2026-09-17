import type { ComponentKind, Instance, InstanceState, PatchOp, ReconcilerState } from './types';

export function initialStateFor(kind: ComponentKind): InstanceState {
  switch (kind) {
    case 'input':
      return { kind: 'input', text: '' };
    case 'counter':
      return { kind: 'counter', count: 0 };
    case 'collapsible':
      return { kind: 'collapsible', collapsed: true, note: '' };
  }
}

function createInstance(id: number, key: string, kind: ComponentKind, label: string): Instance {
  return { instanceId: id, key, kind, label, state: initialStateFor(kind) };
}

/** 应用单条补丁，返回新状态（不可变更新，便于撤销/重做与测试） */
export function applyOp(state: ReconcilerState, op: PatchOp): ReconcilerState {
  const instances = [...state.instances];
  switch (op.type) {
    case 'mount': {
      instances.splice(op.to, 0, createInstance(state.nextId, op.key, op.kind, op.label));
      return { instances, nextId: state.nextId + 1 };
    }
    case 'replace': {
      // key 相同但组件类型不同：旧实例卸载、同位置挂载新实例，局部状态重置
      const at = instances.findIndex((i) => i.instanceId === op.oldInstanceId);
      if (at === -1) throw new Error(`replace: 找不到实例 #${op.oldInstanceId}`);
      instances.splice(at, 1);
      instances.splice(op.to, 0, createInstance(state.nextId, op.key, op.kind, op.label));
      return { instances, nextId: state.nextId + 1 };
    }
    case 'move': {
      const at = instances.findIndex((i) => i.instanceId === op.instanceId);
      if (at === -1) throw new Error(`move: 找不到实例 #${op.instanceId}`);
      const [inst] = instances.splice(at, 1);
      instances.splice(op.to, 0, inst);
      return { instances, nextId: state.nextId };
    }
    case 'unmount': {
      const at = instances.findIndex((i) => i.instanceId === op.instanceId);
      if (at === -1) throw new Error(`unmount: 找不到实例 #${op.instanceId}`);
      instances.splice(at, 1);
      return { instances, nextId: state.nextId };
    }
    case 'update': {
      const at = instances.findIndex((i) => i.instanceId === op.instanceId);
      if (at === -1) throw new Error(`update: 找不到实例 #${op.instanceId}`);
      instances[at] = { ...instances[at], label: op.label };
      return { instances, nextId: state.nextId };
    }
  }
}

export function applyAll(state: ReconcilerState, ops: PatchOp[]): ReconcilerState {
  return ops.reduce(applyOp, state);
}
