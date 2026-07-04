import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../../entities/ui/model/toastStore';

export default function Toast() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const clearToast = useToastStore((s) => s.clearToast);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(clearToast, 2500);
    return () => clearTimeout(id);
  }, [message, seq, clearToast]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={seq}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-3.5 py-2 rounded-xl bg-th-text text-th-bg text-xs font-semibold shadow-lg pointer-events-none whitespace-nowrap"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
