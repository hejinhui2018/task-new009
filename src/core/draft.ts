import type { ItemData } from './types';
import { makeId } from './factory';

/**
 * 左侧编辑器的一行：只描述“想要的树”（key/标题/初始文本），
 * rowId 只是编辑器表单行的身份，与协调使用的 key 完全无关。
 */
export interface DraftItem {
  rowId: string;
  key: string;
  label: string;
  seedText: string;
}

export function fromItems(items: readonly ItemData[]): DraftItem[] {
  return items.map((it) => ({ rowId: makeId('row'), key: it.key, label: it.label, seedText: it.seedText }));
}

export function makeRow(init: { key: string; label: string; seedText?: string }): DraftItem {
  return { rowId: makeId('row'), key: init.key, label: init.label, seedText: init.seedText ?? '' };
}

export function updateRow(
  rows: readonly DraftItem[],
  rowId: string,
  patch: Partial<Omit<DraftItem, 'rowId'>>,
): DraftItem[] {
  return rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r));
}

export function removeRow(rows: readonly DraftItem[], rowId: string): DraftItem[] {
  return rows.filter((r) => r.rowId !== rowId);
}

/** 在 index 处插入新行（index 可等于 length 表示末尾） */
export function insertRowAt(rows: readonly DraftItem[], index: number, row: DraftItem): DraftItem[] {
  const next = [...rows];
  next.splice(Math.max(0, Math.min(index, rows.length)), 0, row);
  return next;
}

export function appendRow(rows: readonly DraftItem[], row: DraftItem): DraftItem[] {
  return [...rows, row];
}

/** 与相邻行交换位置 */
export function moveRow(rows: readonly DraftItem[], rowId: string, dir: -1 | 1): DraftItem[] {
  const i = rows.findIndex((r) => r.rowId === rowId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return [...rows];
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 反转整棵树（一键重排） */
export function reverseRows(rows: readonly DraftItem[]): DraftItem[] {
  return [...rows].reverse();
}

/** 在指定行后面插入一个“key 相同”的新行 —— 人为制造重复 key */
export function insertDuplicateKeyRow(rows: readonly DraftItem[], rowId: string): DraftItem[] {
  const i = rows.findIndex((r) => r.rowId === rowId);
  if (i < 0) return [...rows];
  const src = rows[i];
  const dup = makeRow({ key: src.key, label: `${src.label}·副本`, seedText: `重复${src.key}的初始值` });
  return insertRowAt(rows, i + 1, dup);
}

/**
 * 把某行的 key 换成“另一行正在用的 key”，制造切换 key / 重复 key 场景。
 * 优先选一个与当前不同的 key（形成身份交换）；其余行都同 key 时直接造成重复。
 * 只有一行时在自身 key 后加后缀，确保一定会触发重挂载。
 */
export function cycleKey(rows: readonly DraftItem[], rowId: string): DraftItem[] {
  const i = rows.findIndex((r) => r.rowId === rowId);
  if (i < 0) return [...rows];
  const others = rows.filter((r) => r.rowId !== rowId);
  if (others.length === 0) {
    return updateRow(rows, rowId, { key: `${rows[i].key}2` });
  }
  const different = others.find((r) => r.key !== rows[i].key);
  const target = different ?? others[0];
  return updateRow(rows, rowId, { key: target.key });
}

/** 编辑器侧的即时校验：目标树里哪些 key 重复（不阻断生成补丁） */
export function findDuplicateKeys(rows: readonly DraftItem[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const arr = map.get(r.key);
    if (arr) arr.push(i);
    else map.set(r.key, [i]);
  });
  for (const [key, arr] of map) {
    if (arr.length < 2) map.delete(key);
  }
  return map;
}
