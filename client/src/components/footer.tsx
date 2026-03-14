import React from 'react';
import { Link } from 'wouter';

export default function Footer() {
  return (
    <footer className="bg-background border-t mt-auto py-6">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          © {new Date().getFullYear()} MyKavaBar. All rights reserved.
        </div>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/cookie-policy" className="text-sm text-muted-foreground hover:text-foreground">
            Cookie Policy
          </Link>
          <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-foreground">
            Terms of Service
          </Link>
          <a href="#" className="termly-display-preferences text-sm text-muted-foreground hover:text-foreground">
            Consent Preferences
          </a>
        </nav>
      </div>
    </footer>
  );
}