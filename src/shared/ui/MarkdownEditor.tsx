import { useRef } from 'react';
import { Editor, defaultValueCtx, rootCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';

interface EditorInnerProps {
  defaultValue: string;
  onChange: (v: string) => void;
}

function EditorInner({ defaultValue, onChange }: EditorInnerProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener),
  );

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const li = target.closest('li[data-item-type="task"]') as HTMLElement | null;
    if (!li) return;

    const editor = get();
    if (!editor) return;

    const view = editor.ctx.get(editorViewCtx);
    const { state, dispatch } = view;

    let foundPos = -1;
    state.doc.descendants((node, pos) => {
      if (foundPos !== -1) return false;
      if (node.attrs.checked != null) {
        const domNode = view.nodeDOM(pos);
        if (domNode === li) {
          foundPos = pos;
          return false;
        }
      }
    });

    if (foundPos === -1) return;
    const node = state.doc.nodeAt(foundPos);
    if (!node) return;

    dispatch(
      state.tr.setNodeMarkup(foundPos, undefined, {
        ...node.attrs,
        checked: !node.attrs.checked,
      }),
    );
  }

  return (
    <div onClick={handleClick}>
      <Milkdown />
    </div>
  );
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
        <EditorInner defaultValue={defaultValue} onChange={onChange} />
      </MilkdownProvider>
    </div>
  );
}
