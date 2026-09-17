import { createContext } from 'react';

export interface LifecycleEntry {
  seq: number;
  kind: 'mount' | 'unmount';
  /** 挂载（或卸载）该实例时使用的 key —— 换 key 时会先看到旧 key 卸载、新 key 挂载 */
  key: string;
  /** React 实例身份（useRef 在挂载瞬间生成，只随重挂载变化） */
  uid: string;
}

export const LifecycleContext = createContext<(entry: Omit<LifecycleEntry, 'seq'>) => void>(() => {});
