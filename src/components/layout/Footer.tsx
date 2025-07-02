import { Separator } from '@/components/ui/separator';

export const Footer = () => {
  return (
    <div className="mt-auto">
      <Separator className="my-6" />
      <div className="text-center pb-6">
        <p className="text-sm text-muted-foreground">
          Powered By{' '}
          <a
            href="https://dablietech.club"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary transition-colors underline"
          >
            Dablie Tech Club
          </a>
        </p>
      </div>
    </div>
  );
};