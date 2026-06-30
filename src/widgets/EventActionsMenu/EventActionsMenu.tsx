import { Pencil, Trash2 } from 'lucide-react';
import ContextMenu from '../../shared/ui/ContextMenu';
import type { CalendarEvent } from '../../entities/event/model/types';

interface Props {
  x: number;
  y: number;
  event: CalendarEvent;
  selectedCount: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
}

export default function EventActionsMenu({
  x,
  y,
  event: _event,
  selectedCount,
  onClose,
  onEdit,
  onDelete,
  onDeleteAll,
}: Props) {
  const isMulti = selectedCount >= 2;

  return (
    <ContextMenu
      x={x}
      y={y}
      onClose={onClose}
      items={[
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
