import type { Meta, StoryObj } from '@storybook/react-vite';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'Button',
  component: Button,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Save', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: 'Cancel', variant: 'secondary' },
};

export const Danger: Story = {
  args: { children: 'Delete', variant: 'danger' },
};

export const Ghost: Story = {
  args: { children: 'More', variant: 'ghost' },
};

export const Disabled: Story = {
  args: { children: 'Unavailable', variant: 'primary', disabled: true },
};
