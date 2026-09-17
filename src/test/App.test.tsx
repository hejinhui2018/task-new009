import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

function patchCounter() {
  const heading = screen.getByText(/补丁步骤/);
  return heading.textContent ?? '';
}

describe('App 端到端', () => {
  it('反转 → 生成补丁 → 全部执行 → 验收通过，并可撤销重做', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '整体反转' }));
    await user.click(screen.getByRole('button', { name: /生成补丁/ }));

    // 三步：c 保留，a/b 移动
    expect(screen.getAllByText(/复用并移动|就地复用/)).toHaveLength(3);
    expect(patchCounter()).toMatch(/0\/3/);

    await user.click(screen.getByRole('button', { name: /单步执行/ }));
    expect(patchCounter()).toMatch(/1\/3/);
    await user.click(screen.getByRole('button', { name: /撤销一步/ }));
    expect(patchCounter()).toMatch(/0\/3/);

    await user.click(screen.getByRole('button', { name: '全部执行' }));
    expect(patchCounter()).toMatch(/3\/3/);
    expect(screen.getByRole('status')).toHaveTextContent('验收通过');

    // 右侧真实结果顺序变为 丙、甲、乙（限定在渲染结果容器内，避开补丁说明文本）
    const renderList = document.querySelector('.render-list')!;
    const order = Array.from(renderList.querySelectorAll('.row-label')).map((el) => el.textContent);
    expect(order).toEqual(['项目丙', '项目乙', '项目甲']);
  });

  it('复制同 key 行：编辑器与补丁面板都给出重复 key 警告，相关步骤被标记', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole('button', { name: '复制同 key 行' })[0]);
    expect(screen.getByRole('alert')).toHaveTextContent('检测到重复 key');

    await user.click(screen.getByRole('button', { name: /生成补丁/ }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => el.textContent?.includes('目标树中 key「a」重复'))).toBe(true);

    // 第二个 a 无法复用旧实例 -> 一条“挂载”步骤，并卷入重复 key（高亮样式）
    const dupSteps = document.querySelectorAll('.step--dup');
    expect(dupSteps.length).toBeGreaterThan(0);
  });

  it('插入新 key 并执行：新行挂载、输入框初始化为 seedText，身份流水记录挂载', async () => {
    const user = userEvent.setup();
    render(<App />);

    // 初始三行的挂载事件先清空，避免与本轮混淆
    await user.click(screen.getByRole('button', { name: '清空流水' }));

    await user.click(screen.getAllByRole('button', { name: '后面插新 key' })[0]);
    await user.click(screen.getByRole('button', { name: /生成补丁/ }));
    await user.click(screen.getByRole('button', { name: '全部执行' }));

    // 已有 a,b,c，新行取首个未占用的 n 系列 key = n4
    const newInput = screen.getByLabelText('新项目(n4)的输入框');
    expect(newInput).toHaveValue('n4 的初始值');

    // 身份流水里只有一条挂载（其余三个同 key 全部复用，重排不产生事件）
    const log = screen.getByText(/节点身份/).closest('section')!;
    const mounts = Array.from(log.querySelectorAll<HTMLElement>('.log-kind')).filter((el) =>
      el.textContent?.includes('挂载'),
    );
    expect(mounts).toHaveLength(1);
  });

  it('删除目标行并执行：真实结果少一行；“回到补丁前”可还原', async () => {
    const user = userEvent.setup();
    render(<App />);

    const removeButtons = screen.getAllByRole('button', { name: '删除' });
    await user.click(removeButtons[1]); // 删除项目乙
    await user.click(screen.getByRole('button', { name: /生成补丁/ }));
    await user.click(screen.getByRole('button', { name: '全部执行' }));

    expect(screen.queryByLabelText('项目乙的输入框')).toBeNull();
    expect(screen.getByLabelText('项目甲的输入框')).toBeInTheDocument();
    expect(screen.getByLabelText('项目丙的输入框')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '回到补丁前' }));
    expect(screen.getByLabelText('项目乙的输入框')).toBeInTheDocument();
  });
});
