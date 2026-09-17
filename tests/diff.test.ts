import { describe, expect, it } from 'vitest';
import { computePlan } from '../src/reconciler/diff';
import { applyAll } from '../src/reconciler/apply';
import type { SpecItem } from '../src/reconciler/types';
import { byKey, keysOf, stateFromSpec } from './factory';

const input = (key: string, label = key): SpecItem => ({ key, kind: 'input', label });
const counter = (key: string, label = key): SpecItem => ({ key, kind: 'counter', label });
const collapsible = (key: string, label = key): SpecItem => ({ key, kind: 'collapsible', label });

describe('key 匹配', () => {
  it('按 key 而非位置复用实例：同类型交换位置不交换状态', () => {
    const prev = stateFromSpec([input('a'), input('b')]);
    prev.instances[0].state = { kind: 'input', text: 'A 的内容' };
    prev.instances[1].state = { kind: 'input', text: 'B 的内容' };

    const plan = computePlan(prev.instances, [input('b'), input('a')]);
    expect(plan.ops.some((o) => o.type === 'mount')).toBe(false);
    expect(plan.ops.some((o) => o.type === 'unmount')).toBe(false);

    const after = applyAll(prev, plan.ops);
    expect(keysOf(after)).toEqual(['b', 'a']);
    expect(byKey(after, 'a')?.state).toEqual({ kind: 'input', text: 'A 的内容' });
    expect(byKey(after, 'b')?.state).toEqual({ kind: 'input', text: 'B 的内容' });
  });

  it('重排只产生 move，实例 ID 跟随 key', () => {
    const prev = stateFromSpec([input('a'), counter('b'), collapsible('c')]);
    const idOf = (k: string) => byKey(prev, k)!.instanceId;

    const plan = computePlan(prev.instances, [collapsible('c'), input('a'), counter('b')]);
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({ type: 'move', key: 'c', from: 2, to: 0 });
    expect(plan.fateById[idOf('c')]).toBe('move');
    expect(plan.fateById[idOf('a')]).toBe('reuse');

    const after = applyAll(prev, plan.ops);
    expect(keysOf(after)).toEqual(['c', 'a', 'b']);
    expect(byKey(after, 'c')?.instanceId).toBe(idOf('c'));
  });
});

describe('移动 / 插入 / 删除', () => {
  it('插入：在中间挂载新实例，其余实例原样复用', () => {
    const prev = stateFromSpec([input('a'), input('b')]);
    const plan = computePlan(prev.instances, [input('a'), counter('x'), input('b')]);

    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({ type: 'mount', key: 'x', kind: 'counter', to: 1 });

    const after = applyAll(prev, plan.ops);
    expect(keysOf(after)).toEqual(['a', 'x', 'b']);
    expect(byKey(after, 'a')?.instanceId).toBe(byKey(prev, 'a')?.instanceId);
    expect(byKey(after, 'x')?.state).toEqual({ kind: 'counter', count: 0 });
  });

  it('删除：为消失的 key 生成 unmount，实例随之销毁', () => {
    const prev = stateFromSpec([input('a'), input('b'), input('c')]);
    const plan = computePlan(prev.instances, [input('a')]);

    const unmounts = plan.ops.filter((o) => o.type === 'unmount');
    expect(unmounts).toHaveLength(2);
    expect(unmounts.map((o) => o.key)).toEqual(['c', 'b']); // 倒序卸载

    const after = applyAll(prev, plan.ops);
    expect(keysOf(after)).toEqual(['a']);
  });

  it('混合：重排 + 插入 + 删除一次完成', () => {
    const prev = stateFromSpec([input('a'), input('b'), input('c'), input('d')]);
    const next = [input('d'), counter('x'), input('a')];
    const plan = computePlan(prev.instances, next);
    const after = applyAll(prev, plan.ops);

    expect(keysOf(after)).toEqual(['d', 'x', 'a']);
    expect(plan.ops.filter((o) => o.type === 'unmount').map((o) => o.key).sort()).toEqual(['b', 'c']);
    expect(plan.ops.some((o) => o.type === 'move' && o.key === 'd')).toBe(true);
    expect(plan.ops.some((o) => o.type === 'mount' && o.key === 'x')).toBe(true);
  });

  it('无变更时不产生任何补丁', () => {
    const prev = stateFromSpec([input('a'), counter('b')]);
    const plan = computePlan(prev.instances, [input('a'), counter('b')]);
    expect(plan.ops).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });
});

describe('重复 key', () => {
  it('产生警告，且只有第一个匹配复用旧实例', () => {
    const prev = stateFromSpec([input('a'), input('b')]);
    prev.instances[0].state = { kind: 'input', text: '原来的状态' };

    const plan = computePlan(prev.instances, [input('a'), input('a'), input('b')]);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain('a');
    expect(plan.warnings[0]).toContain('重复');
    expect(plan.nextFates).toEqual(['reuse', 'mount', 'reuse']);

    const after = applyAll(prev, plan.ops);
    expect(keysOf(after)).toEqual(['a', 'a', 'b']);
    const [first, second] = after.instances;
    expect(first.instanceId).toBe(prev.instances[0].instanceId);
    expect(first.state).toEqual({ kind: 'input', text: '原来的状态' });
    expect(second.instanceId).not.toBe(prev.instances[0].instanceId);
    expect(second.state).toEqual({ kind: 'input', text: '' });
  });
});

describe('key 变化与类型变化', () => {
  it('切换 key = 卸载旧实例 + 挂载新实例，状态不迁移', () => {
    const prev = stateFromSpec([input('a'), input('b')]);
    prev.instances[0].state = { kind: 'input', text: '会丢失的内容' };

    const plan = computePlan(prev.instances, [input('a2'), input('b')]);
    expect(plan.ops.map((o) => o.type)).toEqual(['unmount', 'mount']);

    const after = applyAll(prev, plan.ops);
    expect(byKey(after, 'a')).toBeUndefined();
    expect(byKey(after, 'a2')?.state).toEqual({ kind: 'input', text: '' });
  });

  it('key 相同但组件类型不同 → replace，状态重置', () => {
    const prev = stateFromSpec([input('a')]);
    prev.instances[0].state = { kind: 'input', text: '旧文本' };

    const plan = computePlan(prev.instances, [counter('a')]);
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({
      type: 'replace',
      key: 'a',
      oldInstanceId: prev.instances[0].instanceId,
    });

    const after = applyAll(prev, plan.ops);
    expect(after.instances[0].kind).toBe('counter');
    expect(after.instances[0].state).toEqual({ kind: 'counter', count: 0 });
    expect(after.instances[0].instanceId).not.toBe(prev.instances[0].instanceId);
  });

  it('key 与类型都相同、仅标签变化 → update，状态保留', () => {
    const prev = stateFromSpec([input('a', '旧标签')]);
    prev.instances[0].state = { kind: 'input', text: '保留我' };

    const plan = computePlan(prev.instances, [input('a', '新标签')]);
    expect(plan.ops).toEqual([
      { type: 'update', key: 'a', instanceId: prev.instances[0].instanceId, label: '新标签' },
    ]);

    const after = applyAll(prev, plan.ops);
    expect(after.instances[0].label).toBe('新标签');
    expect(after.instances[0].state).toEqual({ kind: 'input', text: '保留我' });
    expect(after.instances[0].instanceId).toBe(prev.instances[0].instanceId);
  });
});
