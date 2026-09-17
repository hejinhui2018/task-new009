import { describe, expect, it } from 'vitest';
import { createItem } from '../core/factory';
import { fromItems } from '../core/draft';
import { reconcile } from '../core/reconcile';
import {
  beginRound,
  currentItems,
  initHistory,
  resetRound,
  runAll,
  stepBackward,
  stepForward,
} from '../core/history';

function setup() {
  const prev = [createItem({ key: 'a', label: '甲' }), createItem({ key: 'b', label: '乙' }), createItem({ key: 'c', label: '丙' })];
  const next = fromItems([
    createItem({ key: 'c', label: '丙' }),
    createItem({ key: 'a', label: '甲' }),
    createItem({ key: 'b', label: '乙' }),
  ]);
  return { prev, plan: reconcile(prev, next) };
}

describe('补丁历史：单步 / 撤销 / 重做', () => {
  it('初始状态是补丁前的列表', () => {
    const { prev } = setup();
    const h = initHistory(prev);
    expect(h.applied).toBe(0);
    expect(currentItems(h).map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('逐步前进后能逐步撤销，快照严格还原（含被卸载实例的 id）', () => {
    const { prev, plan } = setup();
    let h = beginRound(prev);
    h = stepForward(h, plan.steps);
    expect(h.applied).toBe(1);
    h = stepForward(h, plan.steps);
    expect(currentItems(h).map((i) => i.key)).not.toEqual(['a', 'b', 'c']);

    h = stepBackward(h);
    expect(h.applied).toBe(1);
    h = stepBackward(h);
    expect(currentItems(h).map((i) => i.key)).toEqual(['a', 'b', 'c']);
    expect(currentItems(h).map((i) => i.id)).toEqual(prev.map((i) => i.id));

    // 撤销到底不能再撤
    const stuck = stepBackward(h);
    expect(stuck).toBe(h);
  });

  it('撤销后重做仍然得到同一结果（历史分叉不会污染）', () => {
    const { prev, plan } = setup();
    let h = runAll(beginRound(prev), plan.steps);
    const fullKeys = currentItems(h).map((i) => i.key);
    h = stepBackward(stepBackward(h));
    h = stepForward(stepForward(h, plan.steps), plan.steps);
    expect(currentItems(h).map((i) => i.key)).toEqual(fullKeys);
  });

  it('runAll / resetRound 直达终点与起点', () => {
    const { prev, plan } = setup();
    let h = runAll(beginRound(prev), plan.steps);
    expect(h.applied).toBe(plan.steps.length);
    expect(currentItems(h).map((i) => i.key)).toEqual(['c', 'a', 'b']);
    h = resetRound(h);
    expect(currentItems(h).map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('全部执行完后继续前进是安全的空操作', () => {
    const { prev, plan } = setup();
    const h = runAll(beginRound(prev), plan.steps);
    expect(stepForward(h, plan.steps)).toBe(h);
  });
});
