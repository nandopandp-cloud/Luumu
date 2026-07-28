import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  action,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && <label className="text-sm font-semibold text-fg-soft">{label}</label>}
          {action}
        </div>
      )}
      {children}
      {hint && <span className="text-xs text-fg-mut">{hint}</span>}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-strong bg-bg-elev px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-mut transition focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputBase, className)} {...props} />;
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "resize-y", className)} {...props} />;
});

const selectChevron =
  "appearance-none bg-no-repeat bg-[length:16px] bg-[right_10px_center] pr-9 [background-image:url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')]";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(inputBase, "cursor-pointer", selectChevron, className)} {...props} />;
});

// inputBase é usado pelo PasswordInput em ./PasswordInput (arquivo client-only,
// separado deste para não forçar "use client" em quem só usa Input/Select/Field).
export { inputBase };
