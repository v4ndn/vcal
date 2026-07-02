import { Check, Pencil, Trash2 } from 'lucide-react';
import ContextMenu from '../../shared/ui/ContextMenu';
import type { CalendarTask } from '../../entities/task/model/types';

interface Props {
  x: number;
  y: number;
  task: CalendarTask;
  selectedCount: number;
  onClose: () => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
}

export default function TaskActionsMenu({
  x, y, task, selectedCount, onClose,
  onToggleComplete, onEdit, onDelete, onDeleteAll,
}: Props) {
  const isMulti = selectedCount >= 2;

  return (
    <ContextMenu
      x={x}
      y={y}
      onClose={onClose}
      items={[
        {
          label: task.completed ? 'Mark incomplete' : 'Mark complete',
          icon: <Check size={14} />,
          onClick: onToggleComplete,
        },
        {
          label: 'Edit',
          icon: <Pencil size={14} />,
          onClick: onEdit,
        },
        isMulti
          ? {
              label: `Delete all (${selectedCount})`,
              icon: <Trash2 size={14} />,
              onClick: onDeleteAll,
              danger: true as const,
            }
          : {
              label: 'Delete',
              icon: <Trash2 size={14} />,
              onClick: onDelete,
              danger: true as const,
            },
      ]}
    />
  );
}
