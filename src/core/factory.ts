import type { ItemData } from './types';

let counter = 0;

/** 生成引擎侧节点身份 id。重新挂载（新 key）必须拿到新的 id。 */
export function makeId(prefix = 'node'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** 仅供测试复位序号 */
export function resetIdCounter(): void {
  counter = 0;
}

export function createItem(init: {
  key: string;
  label: string;
  seedText?: string;
}): ItemData {
  return {
    id: makeId(),
    key: init.key,
    label: init.label,
    seedText: init.seedText ?? '',
  };
}

/** 深拷贝列表，用于快照 */
export function cloneItems(items: readonly ItemData[]): ItemData[] {
  return items.map((it) => ({ ...it }));
}

/** 内置示例：三个带可区分初始输入的项目 */
export function createDemoItems(): ItemData[] {
  return [
    createItem({ key: 'a', label: '项目甲', seedText: '甲写的草稿' }),
    createItem({ key: 'b', label: '项目乙', seedText: '乙写的草稿' }),
    createItem({ key: 'c', label: '项目丙', seedText: '丙写的草稿' }),
  ];
}
