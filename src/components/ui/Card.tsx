import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  padded?: boolean;
}

export function Card({ className, padded = true, as: Tag = "div", ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-line bg-bg-elev shadow-[var(--shadow-sm)]",
        padded && "p-6",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-bold tracking-tight", className)} {...props} />;
}

export function CardSubtitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-mut", className)} {...props} />;
}
