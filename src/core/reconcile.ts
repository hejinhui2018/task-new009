import type { ItemData, PatchStep, ReconcilePlan, ReconcileWarning } from './types';
import { makeId } from './factory';

/** 左侧编辑器里的一行：只描述“想要的树”，不持有组件状态 */
export interface DraftItem {
  /** 编辑器自身的行身份（与协调用的 key 无关） */
  rowId: string;
  key: string;
  label: string;
  seedText: string;
}

type Flag = 'create' | 'move' | 'stay';

interface Pair {
  desc: DraftItem;
  newIndex: number;
  old: ItemData | null;
  oldIndex: number;
  flag: Flag;
  /** move/create 时的插入锚点：后续最近的“就地复用”实例 id；null 表示追加到末尾 */
  anchorId: string | null;
}

function duplicateKeySet(rows: readonly { key: string }[]): Set<string> {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.key)) dups.add(r.key);
    seen.add(r.key);
  }
  return dups;
}


/**
 * 对比“当前真实列表” prev 与“目标草稿” next，规划出一串可逐步执行的补丁。
 *
 * 匹配/移动判定与 React 一致：
 *  - 按 key 匹配实例；lastPlacedIndex 判定复用节点是否需要移动（Placement）；
 *  - 新 key => 挂载；缺失 key => 卸载；
 *  - 重复 key 时按出现顺序贪心（FIFO）消费旧实例，并对相关步骤打 duplicate 标记、给出警告。
 *
 * move/create 的实际插入位置用“锚点”表达：插到目标树中后方最近一个
 * 不移动的复用实例之前（对应 React commitPlacement 的 insertBefore），
 * 没有这样的锚点则追加到末尾（appendChild）。
 * 因此逐步执行 applyStep 得到的中间/最终数组与 React 的真实 DOM 操作同构。
 *
 * 本函数不修改入参。
 */
export function reconcile(prev: readonly ItemData[], next: readonly DraftItem[]): ReconcilePlan {
  const steps: PatchStep[] = [];
  const warnings: ReconcileWarning[] = [];

  const dupNext = duplicateKeySet(next);
  const dupPrev = duplicateKeySet(prev);

  // 旧实例按 key 排队（FIFO），用于处理重复 key 的贪心匹配
  const queues = new Map<string, ItemData[]>();
  prev.forEach((item) => {
    const q = queues.get(item.key);
    if (q) q.push(item);
    else queues.set(item.key, [item]);
  });

  const consumedIds = new Set<string>();

  // ---- 第一轮：key 匹配 + lastPlacedIndex 分类 ----
  let lastPlacedIndex = -1;
  const pairs: Pair[] = next.map((desc, newIndex) => {
    const q = queues.get(desc.key);
    const old = q && q.length > 0 ? q.shift()! : null;
    if (old) consumedIds.add(old.id);

    let flag: Flag;
    if (!old) {
      flag = 'create';
      // 注意：挂载新节点不推进 lastPlacedIndex（与 React placeChild 一致）
    } else {
      const oldIndex = prev.indexOf(old);
      if (oldIndex < lastPlacedIndex) flag = 'move';
      else {
        flag = 'stay';
        lastPlacedIndex = oldIndex;
      }
    }

    return {
      desc,
      newIndex,
      old,
      oldIndex: old ? prev.indexOf(old) : -1,
      flag,
      anchorId: null,
    };
  });

  // ---- 第二轮：为每个 move/create 找插入锚点（后方最近的 stay 实例） ----
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].flag === 'stay') continue;
    for (let j = i + 1; j < pairs.length; j++) {
      if (pairs[j].flag === 'stay' && pairs[j].old) {
        pairs[i].anchorId = pairs[j].old!.id;
        break;
      }
    }
  }

  // ---- 重复 key 警告 ----
  for (const key of dupNext) {
    const indices: number[] = [];
    next.forEach((d, i) => {
      if (d.key === key) indices.push(i);
    });
    warnings.push({
      level: 'error',
      code: 'DUPLICATE_KEY',
      key,
      message: `目标树中 key「${key}」重复（第 ${indices
        .map((i) => i + 1)
        .join('、')} 行）。React 会抛出警告，匹配退化为尽力而为，局部状态可能挂到错误的项目上。`,
      keys: [key],
      indices,
    });
  }
  for (const key of dupPrev) {
    if (dupNext.has(key)) continue;
    const indices: number[] = [];
    prev.forEach((d, i) => {
      if (d.key === key) indices.push(i);
    });
    warnings.push({
      level: 'warn',
      code: 'DUPLICATE_KEY',
      key,
      message: `当前真实列表中 key「${key}」本身就重复（第 ${indices
        .map((i) => i + 1)
        .join('、')} 行），上一轮渲染已处于未定义行为。`,
      keys: [key],
      indices,
    });
  }

  // ---- 逐步模拟，产出可执行步骤；work 即“此刻的真实列表” ----
  const work: ItemData[] = prev.map((it) => ({ ...it }));

  // 阶段一：卸载（旧有、新无）
  prev.forEach((original) => {
    if (consumedIds.has(original.id)) return;
    const pos = work.findIndex((w) => w.id === original.id);
    steps.push({
      id: original.id,
      type: 'delete',
      phase: 'unmount',
      index: pos,
      key: original.key,
      label: original.label,
      duplicate: dupPrev.has(original.key),
      detail: `卸载「${original.label}」（key=${original.key}）：目标树中找不到该 key，销毁实例 ${original.id}，输入内容/计数/折叠态随之消失`,
    });
    if (pos >= 0) work.splice(pos, 1);
  });

  // 阶段二：按目标树顺序挂载 / 移动 / 就地复用
  for (const pair of pairs) {
    const { desc, old, flag, anchorId } = pair;
    const dup = dupNext.has(desc.key) || dupPrev.has(desc.key);

    if (flag === 'create') {
      const item: ItemData = {
        id: makeId('node'),
        key: desc.key,
        label: desc.label,
        seedText: desc.seedText,
      };
      const to = insertAtAnchor(work, item, anchorId);
      steps.push({
        id: item.id,
        type: 'create',
        phase: 'update',
        index: to,
        key: desc.key,
        label: desc.label,
        item,
        anchorId,
        duplicate: dupNext.has(desc.key),
        detail: `挂载新实例「${desc.label}」（key=${desc.key}）到第 ${to + 1} 位${
          anchorId ? `（插在实例 ${anchorId} 之前）` : '（追加到末尾）'
        }：新 id=${item.id}，输入框初始化为「${desc.seedText}」，计数器归零、展开`,
      });
      continue;
    }

    // old 一定存在
    const inst = old!;
    const labelChanged = inst.label !== desc.label;

    if (labelChanged) {
      warnings.push({
        level: 'info',
        code: 'KEY_REUSED_LABEL_CHANGED',
        key: desc.key,
        message: `key「${desc.key}」被复用，但标题由「${inst.label}」改为「${desc.label}」：仅 props 更新，实例与局部状态都保留（不会重置）。`,
        keys: [desc.key],
        indices: [pair.newIndex],
      });
    }

    const from = work.findIndex((w) => w.id === inst.id);

    if (flag === 'move') {
      const moved: ItemData = { ...work[from], key: desc.key, label: desc.label };
      work.splice(from, 1);
      const to = insertAtAnchor(work, moved, anchorId);
      steps.push({
        id: inst.id,
        type: 'move',
        phase: 'update',
        index: to,
        fromIndex: from,
        key: desc.key,
        label: desc.label,
        anchorId,
        duplicate: dup,
        detail: `复用并移动「${desc.label}」（key=${desc.key}）：实例 ${inst.id} 从第 ${
          from + 1
        } 位移到第 ${to + 1} 位${
          anchorId ? `（插在实例 ${anchorId} 之前）` : '（移动到末尾）'
        }，输入内容、计数与折叠态随实例一起带走`,
      });
    } else {
      work[from] = { ...work[from], label: desc.label };
      steps.push({
        id: inst.id,
        type: 'stay',
        phase: 'update',
        index: from,
        key: desc.key,
        label: desc.label,
        duplicate: dup,
        detail: `就地复用「${desc.label}」（key=${desc.key}）：实例 ${
          inst.id
        } 停在第 ${from + 1} 位，局部状态原样保留${
          labelChanged ? '，仅 props（标题）更新' : ''
        }`,
      });
    }
  }

  return { steps, warnings, expectedNext: work };
}

/** 把 item 插到锚点实例之前；anchor 为 null 或找不到时追加。返回落点下标。 */
function insertAtAnchor(work: ItemData[], item: ItemData, anchorId: string | null): number {
  if (anchorId) {
    const pos = work.findIndex((w) => w.id === anchorId);
    if (pos >= 0) {
      work.splice(pos, 0, item);
      return pos;
    }
  }
  work.push(item);
  return work.length - 1;
}

/**
 * 执行单条补丁，返回新的真实列表（不可变更新），由真实界面状态驱动。
 *  - delete：按实例 id 卸载；
 *  - create：插入步骤携带的全新实例；
 *  - move：按 id 取出实例，插到 anchorId 之前（null = 末尾）；
 *  - stay：仅更新 props（标题）。
 */
export function applyStep(prev: readonly ItemData[], step: PatchStep): ItemData[] {
  switch (step.type) {
    case 'delete':
      return prev.filter((it) => it.id !== step.id);

    case 'create': {
      if (!step.item) return [...prev];
      const next = [...prev];
      insertImmutableAtAnchor(next, step.item, step.anchorId ?? null);
      return next;
    }

    case 'move': {
      const from = prev.findIndex((it) => it.id === step.id);
      if (from < 0) return [...prev];
      const next = [...prev];
      const [it] = next.splice(from, 1);
      insertImmutableAtAnchor(next, { ...it, label: step.label }, step.anchorId ?? null);
      return next;
    }

    case 'stay':
      return prev.map((it) => (it.id === step.id ? { ...it, label: step.label } : it));
  }
}

function insertImmutableAtAnchor(list: ItemData[], item: ItemData, anchorId: string | null): void {
  if (anchorId) {
    const pos = list.findIndex((it) => it.id === anchorId);
    if (pos >= 0) {
      list.splice(pos, 0, item);
      return;
    }
  }
  list.push(item);
}
