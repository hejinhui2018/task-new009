/** 组件类型：输入框 / 计数器 / 可折叠行 */
export type ComponentKind = 'input' | 'counter' | 'collapsible';

/** 草稿树中的一行：下一次渲染的目标描述（key + 组件类型 + props） */
export interface SpecItem {
  key: string;
  kind: ComponentKind;
  label: string;
}

/** 每种组件的局部状态 */
export type InstanceState =
  | { kind: 'input'; text: string }
  | { kind: 'counter'; count: number }
  | { kind: 'collapsible'; collapsed: boolean; note: string };

/**
 * 组件实例：协调器为某个 key 实际维持的节点。
 * instanceId 是节点身份——只要实例被复用，id 与局部状态就跟随它移动。
 */
export interface Instance {
  instanceId: number;
  key: string;
  kind: ComponentKind;
  label: string;
  state: InstanceState;
}

/** 一个节点在一次更新中的命运 */
export type Fate = 'reuse' | 'move' | 'mount' | 'replace' | 'unmount';

/**
 * 补丁步骤。下标（from/to）以「应用该步骤时」的实例数组为准，
 * 按顺序逐步应用即可把旧实例列表变成新实例列表。
 */
export type PatchOp =
  | { type: 'mount'; key: string; kind: ComponentKind; label: string; to: number }
  | { type: 'move'; key: string; instanceId: number; from: number; to: number }
  | { type: 'update'; key: string; instanceId: number; label: string }
  | { type: 'replace'; key: string; oldInstanceId: number; kind: ComponentKind; label: string; from: number; to: number }
  | { type: 'unmount'; key: string; instanceId: number; from: number };

export interface Plan {
  /** 有序的补丁步骤 */
  ops: PatchOp[];
  /** 重复 key 等告警 */
  warnings: string[];
  /** 与目标（草稿）每一行对齐的命运 */
  nextFates: Fate[];
  /** 旧实例 id → 命运（用于在渲染结果上标注） */
  fateById: Record<number, Fate>;
}

/** 协调器状态：当前存活的实例（渲染顺序）+ 下一个实例 id */
export interface ReconcilerState {
  instances: Instance[];
  nextId: number;
}
