import type { DraftItem } from '../core/draft';
import { findDuplicateKeys } from '../core/draft';

interface DraftEditorProps {
  rows: DraftItem[];
  onChangeKey: (rowId: string, value: string) => void;
  onChangeLabel: (rowId: string, value: string) => void;
  onChangeSeed: (rowId: string, value: string) => void;
  onMove: (rowId: string, dir: -1 | 1) => void;
  onRemove: (rowId: string) => void;
  onDuplicateKey: (rowId: string) => void;
  onCycleKey: (rowId: string) => void;
  onInsertAfter: (rowId: string) => void;
  onReverse: () => void;
  onAppend: () => void;
  onResetDemo: () => void;
  onPlan: () => void;
}

export function DraftEditor(props: DraftEditorProps) {
  const {
    rows,
    onChangeKey,
    onChangeLabel,
    onChangeSeed,
    onMove,
    onRemove,
    onDuplicateKey,
    onCycleKey,
    onInsertAfter,
    onReverse,
    onAppend,
    onResetDemo,
    onPlan,
  } = props;

  const dupMap = findDuplicateKeys(rows);

  return (
    <section className="panel" aria-label="目标树编辑器">
      <header className="panel-head">
        <h2>① 目标树编辑（带 key）</h2>
        <div className="toolbar">
          <button type="button" onClick={onReverse} disabled={rows.length < 2}>
            整体反转
          </button>
          <button type="button" onClick={onAppend}>
            末尾插入新 key
          </button>
          <button type="button" onClick={onResetDemo}>
            重置示例
          </button>
          <button type="button" className="primary" onClick={onPlan}>
            生成补丁 →
          </button>
        </div>
      </header>

      {dupMap.size > 0 && (
        <div className="banner banner-error" role="alert">
          ⚠ 检测到重复 key：{[...dupMap.keys()].map((k) => `「${k}」`).join('、')}。仍可生成补丁，但属于
          React 会报警的未定义行为。
        </div>
      )}

      <ol className="draft-list">
        {rows.map((row, i) => {
          const dup = dupMap.has(row.key);
          return (
            <li key={row.rowId} className={`draft-row${dup ? ' draft-row--dup' : ''}`}>
              <div className="draft-row-top">
                <span className="draft-index">#{i + 1}</span>
                <label className="draft-field draft-field--key">
                  <span>key</span>
                  <input
                    value={row.key}
                    onChange={(e) => onChangeKey(row.rowId, e.target.value)}
                    aria-label={`第 ${i + 1} 行的 key`}
                    data-testid={`draft-key-${i}`}
                  />
                </label>
                <label className="draft-field">
                  <span>标题</span>
                  <input
                    value={row.label}
                    onChange={(e) => onChangeLabel(row.rowId, e.target.value)}
                    aria-label={`第 ${i + 1} 行的标题`}
                  />
                </label>
                <label className="draft-field draft-field--seed">
                  <span>挂载初始文本</span>
                  <input
                    value={row.seedText}
                    onChange={(e) => onChangeSeed(row.rowId, e.target.value)}
                    aria-label={`第 ${i + 1} 行的初始文本`}
                  />
                </label>
              </div>
              <div className="draft-row-actions">
                <button type="button" onClick={() => onMove(row.rowId, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button type="button" onClick={() => onMove(row.rowId, 1)} disabled={i === rows.length - 1}>
                  ↓
                </button>
                <button type="button" onClick={() => onInsertAfter(row.rowId)}>
                  后面插新 key
                </button>
                <button type="button" onClick={() => onDuplicateKey(row.rowId)}>
                  复制同 key 行
                </button>
                <button type="button" onClick={() => onCycleKey(row.rowId)} title="把这行 key 换成另一行正在用的 key">
                  切换为他人 key
                </button>
                <button type="button" className="danger" onClick={() => onRemove(row.rowId)}>
                  删除
                </button>
              </div>
              {dup && (
                <div className="dup-note" data-testid={`dup-note-${i}`}>
                  key「{row.key}」在目标树中出现 {dupMap.get(row.key)!.length} 次
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
