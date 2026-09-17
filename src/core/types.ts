/**
 * 核心数据模型。
 *
 * id    —— 引擎预测的节点身份：复用则沿用，重新挂载则换新。
 * key   —— React 用来在两次渲染之间匹配节点的键。
 * seedText —— 新挂载时输入框的初始文本；复用的实例不会回到它。
 *
 * 输入框文本、计数、折叠态是右侧 React 行组件【真正的内部状态】，
 * 不放在这里：验收台要观察的就是 React 重排后把这些状态留给了谁。
 */

export interface ItemData {
  /** 节点身份；切换 key 导致重新挂载时会更换 */
  id: string;
  /** 列表 key，用户可在左侧编辑 */
  key: string;
  /** 展示标题（项目名），与 key 解耦，方便制造“换 key 不换标题”的场景 */
  label: string;
  /** 首次挂载时输入框的初始文本；重新挂载会回到它 */
  seedText: string;
}

export type StepType = 'create' | 'move' | 'delete' | 'stay';
export type StepPhase = 'unmount' | 'update';

/** 一条可单独执行的补丁步骤，对“当前真实列表”做一次 splice 级别的变换 */
export interface PatchStep {
  id: string;
  type: StepType;
  phase: StepPhase;
  /** 执行后落点下标（0 起）；delete 为删除时下标 */
  index: number;
  /** move：来源位置（执行时刻的下标，0 起） */
  fromIndex?: number;
  /** move/create：插入锚点实例 id；插到它之前，null/undefined 表示追加到末尾 */
  anchorId?: string | null;
  key: string;
  label: string;
  /** create：随步骤携带的新节点数据 */
  item?: ItemData;
  /** 该步骤是否卷入重复 key */
  duplicate?: boolean;
  /** 给用户看的说明 */
  detail: string;
}

export interface ReconcileWarning {
  level: 'error' | 'warn' | 'info';
  code: 'DUPLICATE_KEY' | 'KEY_REUSED_LABEL_CHANGED';
  /** 涉及的单个 key（与 keys[0] 一致，便于直接取用） */
  key: string;
  message: string;
  keys: string[];
  /** 出现在目标树中的下标（0 起，删除类警告为旧列表下标） */
  indices: number[];
}

export interface ReconcilePlan {
  steps: PatchStep[];
  warnings: ReconcileWarning[];
  /** 全部步骤执行完后的预期结果 */
  expectedNext: ItemData[];
}
