import { motion } from 'motion/react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ onClose, children, className = '' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <motion.div
        className={`bg-th-surface rounded-2xl shadow-2xl ${className}`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}
