import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useSidebar } from "@/contexts/SidebarContext";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const AutoCollapseDialog = DialogPrimitive.Root;

const AutoCollapseDialogTrigger = DialogPrimitive.Trigger;

const AutoCollapseDialogPortal = DialogPrimitive.Portal;

const AutoCollapseDialogClose = DialogPrimitive.Close;

const AutoCollapseDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
AutoCollapseDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const AutoCollapseDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, children, onOpenChange, ...props }, ref) => {
  const { isSidebarCollapsed, collapseSidebar } = useSidebar();
  const [wasCollapsed, setWasCollapsed] = React.useState(false);

  // Auto-collapse sidebar when dialog opens
  React.useEffect(() => {
    // Store the sidebar state before collapsing
    setWasCollapsed(isSidebarCollapsed);

    // Collapse sidebar when dialog opens
    if (!isSidebarCollapsed) {
      collapseSidebar();
    }
  }, []); // Run only on mount

  return (
    <AutoCollapseDialogPortal>
      <AutoCollapseDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </AutoCollapseDialogPortal>
  );
});
AutoCollapseDialogContent.displayName = DialogPrimitive.Content.displayName;

const AutoCollapseDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
AutoCollapseDialogHeader.displayName = "AutoCollapseDialogHeader";

const AutoCollapseDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
AutoCollapseDialogFooter.displayName = "AutoCollapseDialogFooter";

const AutoCollapseDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
AutoCollapseDialogTitle.displayName = DialogPrimitive.Title.displayName;

const AutoCollapseDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AutoCollapseDialogDescription.displayName =
  DialogPrimitive.Description.displayName;

export {
  AutoCollapseDialog,
  AutoCollapseDialogPortal,
  AutoCollapseDialogOverlay,
  AutoCollapseDialogTrigger,
  AutoCollapseDialogClose,
  AutoCollapseDialogContent,
  AutoCollapseDialogHeader,
  AutoCollapseDialogFooter,
  AutoCollapseDialogTitle,
  AutoCollapseDialogDescription,
};
