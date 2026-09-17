import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';

function committedRow(key: string): HTMLElement {
  const row = screen
    .getAllByTestId('committed-row')
    .find((el) => el.getAttribute('data-key') === key);
  if (!row) throw new Error(`找不到 key=${key} 的渲染行`);
  return row;
}

function committedKeys(): (string | null)[] {
  return screen.getAllByTestId('committed-row').map((el) => el.getAttribute('data-key'));
}

function idOf(key: string): string {
  return within(committedRow(key)).getByTestId('instance-id').textContent ?? '';
}

describe('验收台 UI', () => {
  it('重排后输入框内容跟随同一个实例（状态保留）', () => {
    render(<App />);
    fireEvent.change(within(committedRow('alpha')).getByRole('textbox'), {
      target: { value: 'hello' },
    });
    const before = idOf('alpha');

    fireEvent.click(screen.getByRole('button', { name: '反转顺序' }));
    fireEvent.click(screen.getByRole('button', { name: '生成补丁' }));
    fireEvent.click(screen.getByRole('button', { name: '全部执行' }));

    const input = within(committedRow('alpha')).getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('hello');
    expect(idOf('alpha')).toBe(before);
    expect(committedKeys()).toEqual(['delta', 'gamma', 'beta', 'alpha']);
  });

  it('切换 key 后旧实例被替换，局部状态丢失', () => {
    render(<App />);
    fireEvent.change(within(committedRow('alpha')).getByRole('textbox'), {
      target: { value: 'hello' },
    });

    const firstDraftRow = screen.getAllByTestId('draft-row')[0];
    fireEvent.click(within(firstDraftRow).getByRole('button', { name: '换新 key' }));
    const newKey = (within(firstDraftRow).getByLabelText('key') as HTMLInputElement).value;
    expect(newKey).not.toBe('alpha');

    fireEvent.click(screen.getByRole('button', { name: '生成补丁' }));
    fireEvent.click(screen.getByRole('button', { name: '全部执行' }));

    expect(committedKeys()).not.toContain('alpha');
    const input = within(committedRow(newKey)).getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('重复 key 在编辑器与补丁面板都触发警告', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '制造重复 key' }));
    expect(screen.getByText(/重复的 key：/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '生成补丁' }));
    expect(screen.getByText(/重复出现/)).toBeInTheDocument();
  });

  it('补丁可以单步执行，执行结果驱动渲染', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '反转顺序' }));
    fireEvent.click(screen.getByRole('button', { name: '生成补丁' }));

    expect(screen.getByText('已执行 0 / 3 步')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '单步执行' }));
    expect(screen.getByText('已执行 1 / 3 步')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部执行' }));

    // 全部步骤执行完后自动提交，渲染顺序已反转
    expect(committedKeys()).toEqual(['delta', 'gamma', 'beta', 'alpha']);
  });

  it('撤销 / 重做回退整次更新', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '删除末行' }));
    fireEvent.click(screen.getByRole('button', { name: '生成补丁' }));
    fireEvent.click(screen.getByRole('button', { name: '全部执行' }));
    expect(committedKeys()).toEqual(['alpha', 'beta', 'gamma']);

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(committedKeys()).toEqual(['alpha', 'beta', 'gamma', 'delta']);

    fireEvent.click(screen.getByRole('button', { name: '重做' }));
    expect(committedKeys()).toEqual(['alpha', 'beta', 'gamma']);
  });
});
