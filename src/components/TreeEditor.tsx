import { useState } from 'react';
import type { ComponentKind, Fate, SpecItem } from '../reconciler/types';
import { KINDS, duplicateKeys, fateLabels, freshKey, kindLabels } from '../lib';

interface TreeEditorProps {
  draft: SpecItem[];
  /** 补丁执行期间锁定编辑 */
  locked: boolean;
  /** 与每一行对齐的命运（生成补丁后才有） */
  fates: Fate[] | null;
  dirty: boolean;
  onChange(draft: SpecItem[]): void;
  onRevert(): void;
  onGenerate(): void;
}

/** 左侧：编辑下一次渲染的目标树（key + 组件类型 + 标签） */
export function TreeEditor({ draft, locked, fates, dirty, onChange, onRevert, onGenerate }: TreeEditorProps) {
  const [addKind, setAddKind] = useState<ComponentKind>('input');
  const dups = duplicateKeys(draft);

  const update = (index: number, patch: Partial<SpecItem>) =>
    onChange(draft.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(draft.filter((_, i) => i !== index));

  const insertAt = (index: number, kind: ComponentKind) => {
    const key = freshKey(draft.map((d) => d.key));
    const row: SpecItem = { key, kind, label: `${kindLabels[kind]} ${key}` };
    onChange([...draft.slice(0, index), row, ...draft.slice(index)]);
  };

  /** 复制当前行（同 key），制造重复 key 场景 */
  const duplicateRowKey = (index: number) => {
    const src = draft[index];
    const copy: SpecItem = { ...src, label: `${src.label} 副本` };
    onChange([...draft.slice(0, index + 1), copy, ...draft.slice(index + 1)]);
  };

  /** 给当前行换一个全新的 key：旧实例将被卸载、新实例挂载 */
  const switchKey = (index: number) => {
    const others = draft.filter((_, i) => i !== index).map((d) => d.key);
    update(index, { key: freshKey(others) });
  };

  const reverse = () => onChange([...draft].reverse());

  const shuffle = () => {
    const next = [...draft];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    onChange(next);
  };

  return (
    <section className="panel editor">
      <h2>① 草稿树（下一次渲染的目标）</h2>
      <div className="toolbar">
        <button onClick={reverse} disabled={locked}>反转顺序</button>
        <button onClick={shuffle} disabled={locked}>随机重排</button>
        <button onClick={() => remove(draft.length - 1)} disabled={locked || draft.length === 0}>删除末行</button>
        <button onClick={() => duplicateRowKey(0)} disabled={locked || draft.length === 0}>制造重复 key</button>
        <button onClick={() => switchKey(0)} disabled={locked || draft.length === 0}>切换首行 key</button>
        <button onClick={onRevert} disabled={locked || !dirty}>还原草稿</button>
      </div>

      <ul className="draft-list">
        {draft.map((row, i) => {
          const isDup = dups.includes(row.key);
          const fate = fates?.[i];
          return (
            <li key={i} data-testid="draft-row" className={isDup ? 'dup' : ''}>
              <span className="row-index">{i}</span>
              <input
                aria-label="key"
                className="key-input"
                value={row.key}
                onChange={(e) => update(i, { key: e.target.value })}
                disabled={locked}
              />
              <select
                aria-label="类型"
                value={row.kind}
                onChange={(e) => update(i, { kind: e.target.value as ComponentKind })}
                disabled={locked}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabels[k]}</option>
                ))}
              </select>
              <input
                aria-label="标签"
                className="label-input"
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                disabled={locked}
              />
              <span className="row-buttons">
                <button aria-label="上移" title="上移" onClick={() => move(i, -1)} disabled={locked || i === 0}>↑</button>
                <button aria-label="下移" title="下移" onClick={() => move(i, 1)} disabled={locked || i === draft.length - 1}>↓</button>
                <button aria-label="复制为重复 key" title="复制为重复 key" onClick={() => duplicateRowKey(i)} disabled={locked}>⧉</button>
                <button aria-label="换新 key" title="换新 key" onClick={() => switchKey(i)} disabled={locked}>⇄</button>
                <button aria-label="删除行" title="删除行" onClick={() => remove(i)} disabled={locked}>✕</button>
              </span>
              {fate && <span className={`fate fate-${fate}`}>{fateLabels[fate]}</span>}
            </li>
          );
        })}
        {draft.length === 0 && <li className="empty-row">（空列表）</li>}
      </ul>

      <div className="add-row">
        <select
          aria-label="新行类型"
          value={addKind}
          onChange={(e) => setAddKind(e.target.value as ComponentKind)}
          disabled={locked}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>{kindLabels[k]}</option>
          ))}
        </select>
        <button onClick={() => insertAt(draft.length, addKind)} disabled={locked}>添加行</button>
      </div>

      {dups.length > 0 && (
        <p className="warning">
          {`草稿中存在重复的 key：${dups.join('、')}。生成补丁后，每个 key 只有第一行会复用旧实例，其余行将重新挂载。`}
        </p>
      )}

      <button className="primary" onClick={onGenerate} disabled={locked}>生成补丁</button>
      {locked && <p className="hint">补丁执行中，草稿已锁定。执行完或放弃后可继续编辑。</p>}
    </section>
  );
}
