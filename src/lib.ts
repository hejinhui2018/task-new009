import type { ComponentKind, Fate, PatchOp, SpecItem } from './reconciler/types';

export const KINDS: ComponentKind[] = ['input', 'counter', 'collapsible'];

export const kindLabels: Record<ComponentKind, string> = {
  input: '输入框',
  counter: '计数器',
  collapsible: '折叠行',
};

export const fateLabels: Record<Fate, string> = {
  reuse: '复用',
  move: '移动',
  mount: '挂载',
  replace: '替换',
  unmount: '卸载',
};

/** 实例 id → 稳定的身份颜色，方便肉眼追踪实例移动 */
export function colorFor(instanceId: number): string {
  return `hsl(${(instanceId * 67) % 360} 65% 42%)`;
}

/** 生成一个未被占用的 key */
export function freshKey(taken: Iterable<string>): string {
  const keys = new Set(taken);
  let n = keys.size + 1;
  while (keys.has(`k${n}`)) n++;
  return `k${n}`;
}

/** 草稿中重复出现的 key */
export function duplicateKeys(spec: SpecItem[]): string[] {
  const counts = new Map<string, number>();
  for (const s of spec) counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
  return [...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k);
}

export function describeOp(op: PatchOp): string {
  switch (op.type) {
    case 'mount':
      return `挂载新实例（key=${op.key}，${kindLabels[op.kind]}）到位置 ${op.to}`;
    case 'move':
      return `移动 #${op.instanceId}（key=${op.key}）：位置 ${op.from} → ${op.to}`;
    case 'update':
      return `更新 #${op.instanceId}（key=${op.key}）的标签（状态保留）`;
    case 'replace':
      return `替换 #${op.oldInstanceId}（key=${op.key}）：类型变为「${kindLabels[op.kind]}」，旧实例卸载、新实例挂载（状态重置）`;
    case 'unmount':
      return `卸载 #${op.instanceId}（key=${op.key}）：局部状态销毁`;
  }
}
