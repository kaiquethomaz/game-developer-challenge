import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  readonly open: boolean;
  readonly labelledBy: string;
  readonly onCancel?: () => void;
  readonly children: ReactNode;
}

export function Dialog({ open, labelledBy, onCancel, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel?.();
      }}
    >
      {children}
    </dialog>
  );
}
