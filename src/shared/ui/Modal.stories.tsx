import type { Meta, StoryObj } from '@storybook/react-vite';
import Modal from './Modal';
import Button from './Button';
import Field from './Field';
import { Input } from './Input';

const meta: Meta<typeof Modal> = {
  title: 'Modal',
  component: Modal,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: () => (
    <Modal onClose={() => {}}>
      <div className="p-6 flex flex-col gap-4 w-80">
        <h2 className="text-base font-semibold text-th-text">New Event</h2>
        <Field label="Title">
          <Input placeholder="Event name" />
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" className="px-4 py-2">Cancel</Button>
          <Button variant="primary" className="px-4 py-2">Save</Button>
        </div>
      </div>
    </Modal>
  ),
};
