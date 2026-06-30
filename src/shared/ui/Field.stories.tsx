import type { Meta, StoryObj } from '@storybook/react-vite';
import Field from './Field';
import { Input, Textarea, Select } from './Input';

const meta: Meta<typeof Field> = {
  title: 'Field',
  component: Field,
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
type Story = StoryObj<typeof Field>;

export const WithInput: Story = {
  render: () => (
    <Field label="Title">
      <Input placeholder="Event name" />
    </Field>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <Field label="Description">
      <Textarea placeholder="Add notes…" rows={3} />
    </Field>
  ),
};

export const WithSelect: Story = {
  render: () => (
    <Field label="Repeat">
      <Select>
        <option>Does not repeat</option>
        <option>Daily</option>
        <option>Weekly</option>
      </Select>
    </Field>
  ),
};
