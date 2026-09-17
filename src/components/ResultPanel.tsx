import type { ItemData, PatchStep } from '../core/types';
import { RowItem } from './RowItem';

interface ResultPanelProps {
  items: ItemData[];
  /** 上一步刚执行的补丁，用于标出被影响的实例 */
  lastStep: PatchStep | null;
  expectedNext: ItemData[];
  allDone: boolean;
}

function indexByKey(items: readonly ItemData[]): Map<string, ItemData> {
  return new Map(items.map((it) => [it.key, it]));
}

export function ResultPanel({ items, lastStep, expectedNext, allDone }: ResultPanelProps) {
  // 验收对照：补丁全部执行后，真实列表每一项的 id 必须与引擎预测一致
  const mismatch = allDone
    ? items.filter((it, i) => expectedNext[i]?.id !== it.id || expectedNext[i]?.key !== it.key)
    : [];

  const suspectIds = new Set<string>();
  if (lastStep?.duplicate) {
    if (lastStep.type === 'delete') suspectIds.add(lastStep.id);
    else suspectIds.add(lastStep.id);
  }

  const expectedMap = indexByKey(expectedNext);

  return (
    <section className="panel" aria-label="真实渲染结果">
      <header className="panel-head">
        <h2>③ 真实渲染结果（React 持有的组件状态）</h2>
        <span className="sub-hint">
          试着在输入框写字、点计数、折叠，再去左侧重排或换 key —— 看这些【内部状态】跟着谁走
        </span>
      </header>

      {allDone && mismatch.length > 0 && (
        <div className="banner banner-error" role="alert">
          验收失败：{mismatch.length} 个位置的实例身份/key 与补丁预测不一致，状态可能串台！
        </div>
      )}
      {allDone && mismatch.length === 0 && (
        <div className="banner banner-ok" role="status">
          验收通过：每个 key 对应的实例身份与补丁预测完全一致。
        </div>
      )}

      <div className="render-list">
        {items.length === 0 && <p className="empty-hint">列表为空（全部被卸载）。</p>}
        {items.map((item, i) => {
          const predicted = expectedMap.get(item.key);
          const idMatch = predicted ? predicted.id === item.id : null;
          return (
            <div key={item.key} className="render-slot" data-position={i}>
              <RowItem item={item} position={i} suspect={suspectIds.has(item.id)} />
              {predicted && (
                <div className={`slot-check ${idMatch ? 'ok' : 'bad'}`}>
                  {idMatch ? '身份与预测一致' : `身份不符：预测 ${predicted.id}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
