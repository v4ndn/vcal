import { useEffect, useRef } from 'react';
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';

interface EditorInnerProps {
  defaultValue: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function EditorInner({ defaultValue, onChange, placeholder }: EditorInnerProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(history)
      .use(listener),
  );

  return <Milkdown />;
}

interface Props {
  defaultValue: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function MarkdownEditor({ defaultValue, onChange, placeholder, className = '' }: Props) {
  return (
    <div className={`milkdown-wrap ${className}`} data-placeholder={placeholder}>
      <MilkdownProvider>
        <EditorInner defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} />
      </MilkdownProvider>
    </div>
  );
}
