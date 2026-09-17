import { beforeEach, describe, expect, it } from 'vitest';
import { createItem, resetIdCounter } from '../core/factory';
import { fromItems, type DraftItem } from '../core/draft';
import { reconcile, applyStep } from '../core/reconcile';
import type { ItemData, PatchStep } from '../core/types';

/** 用 [key, label, seedText?] 快速构造真实列表 */
function makeItems(spec: Array<[string, string?, string?]>): ItemData[] {
  return spec.map(([key, label, seed]) => createItem({ key, label: label ?? `L-${key}`, seedText: seed ?? '' }));
}

/** 从真实列表生成“目标树不变”的草稿（只改顺序/键时再自行调整） */
function draftOf(items: ItemData[]): DraftItem[] {
  return fromItems(items);
}

function draft(spec: Array<[string, string?, string?]>): DraftItem[] {
  return fromItems(makeItems(spec));
}

function typesOf(steps: PatchStep[]) {
  return steps.map((s) => s.type);
}

/** 按顺序执行全部步骤，返回最终列表 */
function execute(initial: ItemData[], steps: PatchStep[]): ItemData[] {
  return steps.reduce((list, step) => applyStep(list, step), initial);
}

beforeEach(() => resetIdCounter());

describe('key 匹配', () => {
  it('key 完全相同且顺序不变：全部就地复用，没有挂载/移动/卸载', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const plan = reconcile(prev, draftOf(prev));
    expect(typesOf(plan.steps)).toEqual(['stay', 'stay', 'stay']);
    expect(plan.warnings).toHaveLength(0);
    // id（节点身份）全部沿用
    expect(plan.expectedNext.map((i) => i.id)).toEqual(prev.map((i) => i.id));
  });

  it('整体反转 c,b,a：最后一个先出现者就地，其余移动且身份不变', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const next = draft([['c'], ['b'], ['a']]);
    const plan = reconcile(prev, next);
    expect(typesOf(plan.steps)).toEqual(['stay', 'move', 'move']);
    const finalOrder = execute(prev, plan.steps).map((i) => i.key);
    expect(finalOrder).toEqual(['c', 'b', 'a']);
    // 三个实例都被复用，没有新 id
    expect(new Set(plan.expectedNext.map((i) => i.id))).toEqual(new Set(prev.map((i) => i.id)));
  });

  it('单个前置：[a,b,c] -> [b,c,a] 只有 a 需要移动到末尾', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const plan = reconcile(prev, draft([['b'], ['c'], ['a']]));
    expect(typesOf(plan.steps)).toEqual(['stay', 'stay', 'move']);
    expect(execute(prev, plan.steps).map((i) => i.key)).toEqual(['b', 'c', 'a']);
  });

  it('新 key 无法匹配任何旧实例：标记为挂载', () => {
    const prev = makeItems([['a'], ['b']]);
    const plan = reconcile(prev, draft([['x'], ['a'], ['b']]));
    expect(typesOf(plan.steps)).toEqual(['create', 'stay', 'stay']);
    expect(plan.steps[0].item?.key).toBe('x');
  });

  it('key 改名（a -> z）：旧实例卸载 + 新实例挂载，身份更换', () => {
    const prev = makeItems([['a'], ['b']]);
    const plan = reconcile(prev, draft([['z'], ['b']]));
    expect(typesOf(plan.steps)).toEqual(['delete', 'create', 'stay']);
    const finalList = execute(prev, plan.steps);
    expect(finalList.map((i) => i.key)).toEqual(['z', 'b']);
    expect(finalList[0].id).not.toBe(prev[0].id);
    expect(finalList[1].id).toBe(prev[1].id);
  });

  it('key 互换 [a,b] -> [b,a]：两个实例都保留，行与状态的归属随 key 走', () => {
    const prev = makeItems([['a', '甲'], ['b', '乙']]);
    const plan = reconcile(prev, draft([['b', '乙'], ['a', '甲']]));
    expect(typesOf(plan.steps)).toEqual(['stay', 'move']);
    const finalList = execute(prev, plan.steps);
    expect(finalList.map((i) => i.key)).toEqual(['b', 'a']);
    expect(finalList[0].id).toBe(prev[1].id); // 第一行现在是原来的“乙”实例
    expect(finalList[1].id).toBe(prev[0].id);
  });
});

describe('状态保留（通过节点身份 id 验证）', () => {
  it('移动的实例沿用原 id —— 内部状态必须随之带走而不是重置', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const plan = reconcile(prev, draft([['c'], ['a'], ['b']]));
    const finalList = execute(prev, plan.steps);
    const byKey = new Map(finalList.map((i) => [i.key, i.id]));
    expect(byKey.get('a')).toBe(prev[0].id);
    expect(byKey.get('b')).toBe(prev[1].id);
    expect(byKey.get('c')).toBe(prev[2].id);
  });

  it('挂载的新实例拿到全新 id 与新的 seedText，计数器语义上归零', () => {
    const prev = makeItems([['a']]);
    const plan = reconcile(prev, draft([['a'], ['n', '新项目', '新种子']]));
    const createStep = plan.steps.find((s) => s.type === 'create')!;
    expect(createStep.item?.id).not.toBe(prev[0].id);
    expect(createStep.item?.seedText).toBe('新种子');
  });

  it('删除的实例 id 不再出现；其内部状态随卸载消失', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const plan = reconcile(prev, draft([['a'], ['c']]));
    expect(typesOf(plan.steps)).toEqual(['delete', 'stay', 'stay']);
    const finalList = execute(prev, plan.steps);
    expect(finalList.map((i) => i.id)).not.toContain(prev[1].id);
  });

  it('同 key 改标题只是 props 更新：实例 id 保留，并给出 info 提示', () => {
    const prev = makeItems([['a', '旧标题']]);
    const plan = reconcile(prev, draft([['a', '新标题']]));
    expect(typesOf(plan.steps)).toEqual(['stay']);
    expect(plan.expectedNext[0].id).toBe(prev[0].id);
    expect(plan.expectedNext[0].label).toBe('新标题');
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].code).toBe('KEY_REUSED_LABEL_CHANGED');
  });
});

describe('移动 / 插入 / 删除的逐步执行', () => {
  it('混合变换 [a,b,c,d] -> [x,c,a,y]：删除 b,d，插入 x,y，移动 a，结果与预测一致', () => {
    const prev = makeItems([['a'], ['b'], ['c'], ['d']]);
    const plan = reconcile(prev, draft([['x'], ['c'], ['a'], ['y']]));
    expect(typesOf(plan.steps)).toEqual(['delete', 'delete', 'create', 'stay', 'move', 'create']);

    // 逐步执行的每一步都必须自洽（按步骤携带的锚点/下标操作）
    let list = prev;
    plan.steps.forEach((step, i) => {
      list = applyStep(list, step);
      // 已执行步骤涉及的 id 与最终预测不矛盾
      const known = new Set(plan.expectedNext.map((n) => n.id));
      if (step.type !== 'delete') expect(known.has(step.id) || step.type === 'create').toBe(true);
      void i;
    });
    expect(list.map((i) => i.key)).toEqual(['x', 'c', 'a', 'y']);
    expect(list.map((i) => i.id)).toEqual(plan.expectedNext.map((i) => i.id));
  });

  it('删除步骤的 index 是“执行时刻”的下标（先删 a 后 c 的位置会变化）', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    const plan = reconcile(prev, draft([['b']]));
    const deletes = plan.steps.filter((s) => s.type === 'delete');
    expect(deletes.map((s) => s.key)).toEqual(['a', 'c']);
    expect(deletes[0].index).toBe(0);
    expect(deletes[1].index).toBe(1); // a 删掉后 c 前移
  });

  it('空目标树：所有旧实例依次卸载', () => {
    const prev = makeItems([['a'], ['b']]);
    const plan = reconcile(prev, []);
    expect(typesOf(plan.steps)).toEqual(['delete', 'delete']);
    expect(execute(prev, plan.steps)).toHaveLength(0);
  });

  it('空列表起步：全部是挂载', () => {
    const plan = reconcile([], draft([['a'], ['b']]));
    expect(typesOf(plan.steps)).toEqual(['create', 'create']);
    expect(execute([], plan.steps).map((i) => i.key)).toEqual(['a', 'b']);
  });
});

describe('重复 key 警告', () => {
  it('目标树出现重复 key：给出错误警告、标出下标，并标记相关步骤', () => {
    const prev = makeItems([['a'], ['b'], ['c']]);
    // 目标：b 出现两次（一个复用旧 b，一个新挂载）
    const next = draft([['b'], ['b'], ['c']]);
    const plan = reconcile(prev, next);

    const dup = plan.warnings.filter((w) => w.code === 'DUPLICATE_KEY');
    expect(dup.length).toBeGreaterThanOrEqual(1);
    expect(dup[0].level).toBe('error');
    expect(dup[0].indices).toEqual([0, 1]);

    // FIFO：第一个 b 复用旧实例，第二个 b 是新挂载 —— 状态可能挂错项目
    const finalList = execute(prev, plan.steps);
    expect(finalList[0].id).toBe(prev[1].id);
    expect(finalList[1].id).not.toBe(prev[1].id);

    // 涉及重复 key 的步骤被打标，UI 可高亮
    expect(plan.steps.filter((s) => s.duplicate).length).toBeGreaterThan(0);
  });

  it('当前列表本身已含重复 key 时给出 warn 级警告', () => {
    const prev = makeItems([['a', '甲一'], ['a', '甲二'], ['b']]);
    const plan = reconcile(prev, draft([['a'], ['b']]));
    const warn = plan.warnings.find((w) => w.level === 'warn' && w.code === 'DUPLICATE_KEY');
    expect(warn).toBeTruthy();
    // 两个 a 中一个被贪心复用，另一个卸载（卸载步骤带 duplicate 标记）
    const deleteSteps = plan.steps.filter((s) => s.type === 'delete');
    expect(deleteSteps).toHaveLength(1);
    expect(deleteSteps[0].duplicate).toBe(true);
  });
});
