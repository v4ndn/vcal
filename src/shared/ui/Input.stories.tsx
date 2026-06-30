import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input, Textarea, Select } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Input',
  component: Input,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text…' },
};

export const WithValue: Story = {
  args: { value: 'Meeting with team', readOnly: true },
};

export const TextareaDefault: StoryObj<typeof Textarea> = {
  render: () => (
    <div style={{ width: 280 }}>
      <Textarea placeholder="Add a description…" rows={3} />
    </div>
  ),
};

export const SelectDefault: StoryObj<typeof Select> = {
  render: () => (
    <div style={{ width: 280 }}>
      <Select>
        <option>Does not repeat</option>
        <option>Daily</option>
        <option>Weekly</option>
        <option>Monthly</option>
      </Select>
    </div>
  ),
};
