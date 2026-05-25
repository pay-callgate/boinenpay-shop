"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { cn } from "@/lib/utils";

const inputClassName =
  "min-w-0 flex-1 border-0 px-3 text-center text-sm tabular-nums text-slate-900 [-moz-appearance:textfield] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const wrapClassName =
  "flex h-10 w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm transition focus-within:border-slate-600 focus-within:ring-1 focus-within:ring-slate-600";

const btnClassName =
  "flex w-11 shrink-0 items-center justify-center border-slate-200 bg-slate-50 text-lg font-semibold leading-none text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

type RhfMode = {
  mode: "rhf";
  id: string;
  label: string;
  /** 루트 래퍼 (모달에서는 그리드 셀 폭 등을 맞출 때 비우거나 `min-w-0 w-full`) */
  className?: string;
  registerReturn: UseFormRegisterReturn;
  decrementDisabled: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  errorMessage?: string;
};

type ControlledMode = {
  mode: "controlled";
  id: string;
  label: string;
  className?: string;
  value: number;
  onChange: (next: number) => void;
  errorMessage?: string;
};

type StockQtyStepperProps = RhfMode | ControlledMode;

function normalizeQty(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function StockQtyStepper(props: StockQtyStepperProps) {
  const errorMessage = props.errorMessage;

  if (props.mode === "controlled") {
    const { id, label, value, onChange, className } = props;
    const q = normalizeQty(value);
    return (
      <div className={cn("min-w-0 w-full", className)}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label}
        </label>
        <div className={wrapClassName}>
          <button
            type="button"
            aria-label="재고 1개 감소"
            onClick={() => onChange(Math.max(0, q - 1))}
            disabled={q <= 0}
            className={`${btnClassName} border-r`}
          >
            −
          </button>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange(0);
                return;
              }
              const parsed = parseInt(raw, 10);
              if (Number.isFinite(parsed) && parsed >= 0) {
                onChange(parsed);
              }
            }}
            className={inputClassName}
          />
          <button
            type="button"
            aria-label="재고 1개 증가"
            onClick={() => onChange(q + 1)}
            className={`${btnClassName} border-l`}
          >
            +
          </button>
        </div>
        {errorMessage ? <p className="mt-1 text-xs text-red-600">{errorMessage}</p> : null}
      </div>
    );
  }

  const { id, label, registerReturn, decrementDisabled, onDecrement, onIncrement, className } = props;
  return (
    <div className={cn("min-w-0 w-full", className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className={wrapClassName}>
        <button
          type="button"
          aria-label="재고 1개 감소"
          onClick={onDecrement}
          disabled={decrementDisabled}
          className={`${btnClassName} border-r`}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          {...registerReturn}
          className={inputClassName}
        />
        <button
          type="button"
          aria-label="재고 1개 증가"
          onClick={onIncrement}
          className={`${btnClassName} border-l`}
        >
          +
        </button>
      </div>
      {errorMessage ? <p className="mt-1 text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
