"use client";

import * as React from "react";

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
  undefined
);

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen: handleOpenChange }}>
      {children ?? null}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogTrigger must be used within Dialog");

  return (
    <div onClick={() => context.setOpen(true)} className="inline-block">
      {children}
    </div>
  );
}

export function DialogContent({
  children,
  className = "",
  backdropText,
}: {
  children: React.ReactNode;
  className?: string;
  /** 배경(backdrop) 위·모달 아래에 보일 안내 문구. 오버레이를 통과해 읽을 수 있게 표시 */
  backdropText?: string;
}) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogContent must be used within Dialog");

  if (!context.open) return null;

  const modalBox = (
    <div
      className={`relative z-50 flex w-full max-h-[90vh] flex-col overflow-hidden bg-white rounded-lg shadow-2xl ${
        className || "max-w-5xl"
      }`}
    >
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - 어두운 투명 배경 */}
      <div
        className="fixed inset-0 bg-black/60"
        onClick={() => context.setOpen(false)}
      />
      {/* 모달 박스 기준으로 배경 문구를 바로 위쪽 허공에 배치 (겹침 없음) */}
      {backdropText ? (
        <div className="relative pointer-events-none w-full max-w-[90vw] flex justify-center">
          <p
            className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-white text-xl font-bold tracking-wide z-50"
            aria-hidden
          >
            {backdropText}
          </p>
          <div className="pointer-events-auto w-full flex justify-center">
            {modalBox}
          </div>
        </div>
      ) : (
        modalBox
      )}
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-800 px-6 py-4 rounded-t-lg">
      {children}
    </div>
  );
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white">{children}</h2>;
}

export function DialogDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-slate-300 ${className}`.trim()}>
      {children}
    </p>
  );
}

export function DialogClose({ children }: { children?: React.ReactNode }) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogClose must be used within Dialog");

  return (
    <button
      type="button"
      onClick={() => context.setOpen(false)}
      className="absolute right-4 top-4 text-white hover:text-slate-300 transition-colors text-xl"
    >
      {children ?? "✕"}
    </button>
  );
}

export function DialogBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 min-h-0 overflow-y-auto ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
      {children}
    </div>
  );
}
