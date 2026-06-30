import type { Meta, StoryObj } from '@storybook/react-vite';
import { Edit2, Trash2, Copy } from 'lucide-react';
import ContextMenu from './ContextMenu';

const meta: Meta<typeof ContextMenu> = {
  title: 'ContextMenu',
  component: ContextMenu,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof ContextMenu>;

export const Default: Story = {
  render: () => (
    <ContextMenu
      x={80}
      y={80}
      onClose={() => {}}
      items={[
        { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => {} },
        { label: 'Duplicate', icon: <Copy size={14} />, onClick: () => {} },
        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => {}, danger: true },
      ]}
    />
  ),
};
