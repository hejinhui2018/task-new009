import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowItem } from '../components/RowItem';
import { LifecycleContext, type LifecycleEntry } from '../components/lifecycle';
import type { ItemData } from '../core/types';
import { createItem } from '../core/factory';

function List({ items, onEvent }: { items: ItemData[]; onEvent?: (e: Omit<LifecycleEntry, 'seq'>) => void }) {
  return (
    <LifecycleContext.Provider value={onEvent ?? (() => {})}>
      <div>
        {items.map((item, i) => (
          <RowItem key={item.key} item={item} position={i} />
        ))}
      </div>
    </LifecycleContext.Provider>
  );
}

function item(key: string, label = `L-${key}`, seedText = ''): ItemData {
  return createItem({ key, label, seedText });
}

describe('真实 React 渲染：key 与内部状态', () => {
  it('重排后同 key 实例的输入框内容、计数、折叠态原样保留', async () => {
    const user = userEvent.setup();
    const a = item('a', '项目甲', '甲种子');
    const b = item('b', '项目乙', '乙种子');
    const c = item('c', '项目丙', '丙种子');
    const { rerender } = render(<List items={[a, b, c]} />);

    // 在“项目甲”上制造内部状态：输入、计数 +2、折叠
    const inputA = screen.getByLabelText('项目甲的输入框');
    await user.type(inputA, '写了一半');
    const cardA = inputA.closest('.row-card')!;
    await user.click(within(cardA as HTMLElement).getByRole('button', { name: '+1' }));
    await user.click(within(cardA as HTMLElement).getByRole('button', { name: '+1' }));
    await user.click(within(cardA as HTMLElement).getByRole('button', { name: '折叠' }));
    expect(within(cardA as HTMLElement).queryByLabelText('项目甲的输入框')).toBeNull();

    // 重排为 [c, a, b]：key 不变，React 只移动 DOM
    rerender(<List items={[c, a, b]} />);

    // “项目甲”仍是折叠态（折叠态被带走），展开后内容仍是“写了一半”，计数仍是 2
    await user.click(screen.getByRole('button', { name: '展开' }));

    const inputA2 = screen.getByLabelText('项目甲的输入框');
    expect(inputA2).toHaveValue('甲种子写了一半');
    const cardOpen = inputA2.closest('.row-card')!;
    expect(within(cardOpen as HTMLElement).getByText('2')).toBeInTheDocument();
  });

  it('切换 key 触发重挂载：输入框回到新 seedText、计数归零、折叠展开', async () => {
    const user = userEvent.setup();
    const a = item('a', '项目甲', '甲种子');
    const { rerender } = render(<List items={[a]} />);

    const input = screen.getByLabelText('项目甲的输入框');
    await user.type(input, '脏数据');
    await user.click(screen.getByRole('button', { name: '+1' }));

    // 同一标题、同一位置，但 key 从 a 换成 z（且 seedText 改变）
    const z = item('z', '项目甲', '重挂载种子');
    rerender(<List items={[z]} />);

    const after = screen.getByLabelText('项目甲的输入框');
    expect(after).toHaveValue('重挂载种子');
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getByRole('button', { name: '折叠' })).toBeInTheDocument();
  });

  it('删除一个 key：对应实例消失，其余实例的内部状态不受影响', async () => {
    const user = userEvent.setup();
    const a = item('a', '项目甲');
    const b = item('b', '项目乙');
    const { rerender } = render(<List items={[a, b]} />);

    await user.type(screen.getByLabelText('项目甲的输入框'), '甲的字');
    await user.type(screen.getByLabelText('项目乙的输入框'), '乙的字');

    rerender(<List items={[b]} />);

    expect(screen.queryByLabelText('项目甲的输入框')).toBeNull();
    expect(screen.getByLabelText('项目乙的输入框')).toHaveValue('乙的字');
  });

  it('生命周期上报：同 key 重排零事件；换 key 出现“旧 key 卸载 + 新 key 挂载”', () => {
    const events: Array<Omit<LifecycleEntry, 'seq'>> = [];
    const onEvent = (e: Omit<LifecycleEntry, 'seq'>) => events.push(e);
    const a = item('a', '项目甲');
    const b = item('b', '项目乙');
    const c = item('c', '项目丙');

    const { rerender, unmount } = render(<List items={[a, b, c]} onEvent={onEvent} />);
    events.length = 0;

    rerender(<List items={[c, a, b]} onEvent={onEvent} />);
    expect(events).toHaveLength(0); // 全是复用 + 移动

    rerender(<List items={[c, { ...a, key: 'z', seedText: '' }, b]} onEvent={onEvent} />);
    const kinds = events.map((e) => `${e.kind}:${e.key}`);
    expect(kinds).toContain('unmount:a');
    expect(kinds).toContain('mount:z');

    unmount();
  });

  it('真实 React 遇到重复 key 会在控制台打印警告', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a1 = item('a', '项目甲');
    const a2 = item('a', '项目甲副本');
    render(<List items={[a1, a2]} />);
    const msg = spy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(msg).toMatch(/same key/i);
    spy.mockRestore();
  });
});
