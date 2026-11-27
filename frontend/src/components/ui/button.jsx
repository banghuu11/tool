import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-blue-700',
        destructive: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
        outline: 'border border-border bg-card text-foreground hover:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-slate-200/80',
        ghost: 'hover:bg-secondary text-foreground',
        success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-lg px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export function Button({ className, variant, size, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
