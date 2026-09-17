import { describe, expect, it } from 'vitest';
import { computePlan } from '../src/reconciler/diff';
import { applyAll, applyOp } from '../src/reconciler/apply';
import type { SpecItem } from '../src/reconciler/types';
import { byKey, keysOf, stateFromSpec } from './factory';

const spec: SpecItem[] = [
  { key: 'alpha', kind: 'input', label: 'A' },
  { key: 'beta', kind: 'counter', label: 'B' },
  { key: 'gamma', kind: 'collapsible', label: 'C' },
];

/** 构造一批带有非默认局部状态的实例 */
function withStates() {
  const s = stateFromSpec(spec);
  s.instances[0].state = { kind: 'input', text: 'hello' };
  s.instances[1].state = { kind: 'counter', count: 7 };
  s.instances[2].state = { kind: 'collapsible', collapsed: false, note: '便签' };
  return s;
}

describe('状态保留', () => {
  it('重排后每个 key 的局部状态原样跟随', () => {
    const prev = withStates();
    const plan = computePlan(prev.instances, [...spec].reverse());
    const after = applyAll(prev, plan.ops);

    expect(keysOf(after)).toEqual(['gamma', 'beta', 'alpha']);
    expect(byKey(after, 'alpha')?.state).toEqual({ kind: 'input', text: 'hello' });
    expect(byKey(after, 'beta')?.state).toEqual({ kind: 'counter', count: 7 });
    expect(byKey(after, 'gamma')?.state).toEqual({ kind: 'collapsible', collapsed: false, note: '便签' });
  });

  it('插入与删除不影响幸存实例的状态', () => {
    const prev = withStates();
    const next: SpecItem[] = [
      { key: 'gamma', kind: 'collapsible', label: 'C' },
      { key: 'new', kind: 'input', label: 'N' },
      { key: 'alpha', kind: 'input', label: 'A' },
    ];
    const after = applyAll(prev, computePlan(prev.instances, next).ops);

    expect(keysOf(after)).toEqual(['gamma', 'new', 'alpha']);
    expect(byKey(after, 'alpha')?.state).toEqual({ kind: 'input', text: 'hello' });
    expect(byKey(after, 'gamma')?.state).toEqual({ kind: 'collapsible', collapsed: false, note: '便签' });
    expect(byKey(after, 'new')?.state).toEqual({ kind: 'input', text: '' });
  });

  it('单步执行与一次性执行结果一致', () => {
    const prev = withStates();
    const next: SpecItem[] = [
      { key: 'gamma', kind: 'collapsible', label: 'C2' },
      { key: 'new', kind: 'counter', label: 'N' },
      { key: 'alpha', kind: 'input', label: 'A' },
    ];
    const plan = computePlan(prev.instances, next);

    let stepped = prev;
    for (const op of plan.ops) stepped = applyOp(stepped, op);

    const atOnce = applyAll(prev, plan.ops);
    expect(stepped).toEqual(atOnce);
    expect(keysOf(stepped)).toEqual(['gamma', 'new', 'alpha']);
  });
});
