import type { Fate, Instance, PatchOp, Plan, SpecItem } from './types';

/**
 * keyed 协调：比较「当前实例列表」与「目标草稿」，产出有序的补丁步骤。
 *
 * 语义（与 React 一致）：
 * - key 相同且组件类型相同 → 复用实例（局部状态保留），位置变了就 move；
 * - key 相同但组件类型不同 → replace：旧实例卸载、新实例挂载，状态重置；
 * - key 只出现在目标里 → mount；只出现在旧列表里 → unmount（状态销毁）；
 * - 目标里出现重复 key → 告警，且只有第一个匹配复用旧实例，其余重新挂载。
 *
 * 算法：先按 key 匹配出目标排列，再在模拟的工作数组上
 * 「先卸载、然后从左到右把每个位置归位」，沿途记录补丁。
 * 每条补丁的下标都以它被执行那一刻的数组为准。
 */
export function computePlan(prev: Instance[], next: SpecItem[]): Plan {
  const warnings: string[] = [];

  // 目标中的重复 key 检测
  const counts = new Map<string, number>();
  for (const item of next) counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  for (const [key, count] of counts) {
    if (count > 1) {
      warnings.push(
        `key "${key}" 重复出现 ${count} 次：仅第一个会复用旧实例，其余将重新挂载，状态可能错位`,
      );
    }
  }

  // 旧实例按 key 入队（队列可容忍已提交的重复 key：先来先匹配）
  const pool = new Map<string, Instance[]>();
  for (const inst of prev) {
    const queue = pool.get(inst.key);
    if (queue) queue.push(inst);
    else pool.set(inst.key, [inst]);
  }

  type Target =
    | { type: 'reuse'; inst: Instance; spec: SpecItem }
    | { type: 'mount'; spec: SpecItem };

  const targets: Target[] = next.map((spec) => {
    const queue = pool.get(spec.key);
    if (queue && queue.length > 0) {
      return { type: 'reuse', inst: queue.shift()!, spec };
    }
    return { type: 'mount', spec };
  });

  const removed = [...pool.values()].flat();

  const ops: PatchOp[] = [];
  const nextFates: Fate[] = new Array<Fate>(next.length);
  const fateById: Record<number, Fate> = {};

  // 工作数组：模拟补丁逐步应用后的实例排列（fresh 表示刚挂载的占位）
  type Slot = { inst: Instance } | { fresh: true };
  const working: Slot[] = prev.map((inst) => ({ inst }));

  // 1) 先卸载消失的实例（倒序，保证下标有效）
  const removedIds = new Set(removed.map((r) => r.instanceId));
  for (let i = working.length - 1; i >= 0; i--) {
    const slot = working[i];
    if ('inst' in slot && removedIds.has(slot.inst.instanceId)) {
      ops.push({ type: 'unmount', key: slot.inst.key, instanceId: slot.inst.instanceId, from: i });
      fateById[slot.inst.instanceId] = 'unmount';
      working.splice(i, 1);
    }
  }

  // 2) 从左到右把每个位置归位
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    if (target.type === 'mount') {
      ops.push({ type: 'mount', key: target.spec.key, kind: target.spec.kind, label: target.spec.label, to: i });
      working.splice(i, 0, { fresh: true });
      nextFates[i] = 'mount';
      continue;
    }

    const { inst, spec } = target;
    const j = working.findIndex((s) => 'inst' in s && s.inst.instanceId === inst.instanceId);
    if (j === -1) throw new Error(`内部错误：实例 #${inst.instanceId} 不在工作数组中`);

    if (inst.kind !== spec.kind) {
      ops.push({
        type: 'replace',
        key: spec.key,
        oldInstanceId: inst.instanceId,
        kind: spec.kind,
        label: spec.label,
        from: j,
        to: i,
      });
      working.splice(j, 1);
      working.splice(i, 0, { fresh: true });
      nextFates[i] = 'replace';
      fateById[inst.instanceId] = 'replace';
      continue;
    }

    if (j !== i) {
      ops.push({ type: 'move', key: inst.key, instanceId: inst.instanceId, from: j, to: i });
      const [slot] = working.splice(j, 1);
      working.splice(i, 0, slot);
      nextFates[i] = 'move';
      fateById[inst.instanceId] = 'move';
    } else {
      nextFates[i] = 'reuse';
      fateById[inst.instanceId] = 'reuse';
    }

    if (inst.label !== spec.label) {
      ops.push({ type: 'update', key: inst.key, instanceId: inst.instanceId, label: spec.label });
    }
  }

  return { ops, warnings, nextFates, fateById };
}
