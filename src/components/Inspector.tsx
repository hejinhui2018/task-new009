import type { Instance } from '../reconciler/types';
import { colorFor, kindLabels } from '../lib';

interface InspectorProps {
  selectedId: number | null;
  instance: Instance | undefined;
}

/** 右下：选中节点的身份与局部状态 */
export function Inspector({ selectedId, instance }: InspectorProps) {
  return (
    <section className="panel inspector">
      <h2>④ 节点身份</h2>
      {selectedId === null ? (
        <p className="hint">点击「渲染结果」中的一行，查看该节点的身份与局部状态。</p>
      ) : instance ? (
        <>
          <table className="identity">
            <tbody>
              <tr>
                <th>实例 ID</th>
                <td>
                  <span className="dot" style={{ background: colorFor(instance.instanceId) }} />
                  {` #${instance.instanceId}`}
                </td>
              </tr>
              <tr><th>key</th><td><code>{instance.key}</code></td></tr>
              <tr><th>组件类型</th><td>{kindLabels[instance.kind]}</td></tr>
              <tr><th>标签</th><td>{instance.label}</td></tr>
            </tbody>
          </table>
          <h3>局部状态</h3>
          <pre>{JSON.stringify(instance.state, null, 2)}</pre>
        </>
      ) : (
        <p className="warning">{`实例 #${selectedId} 已卸载：身份销毁，局部状态随之丢失。`}</p>
      )}
    </section>
  );
}
