import React from 'react';
import { Link } from 'wouter';
import { ExternalLink, MapPin, Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">MyKavaBar</h3>
            <p className="text-sm text-muted-foreground">
              Connecting kava enthusiasts with the best kava bars throughout the United States.
            </p>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>US Coverage</span>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/learn" className="text-muted-foreground hover:text-foreground transition-colors">
                  Kava Learning Hub
                </Link>
              </li>
              <li>
                <Link href="/learn/history" className="text-muted-foreground hover:text-foreground transition-colors">
                  History of Kava
                </Link>
              </li>
              <li>
                <Link href="/learn/varieties" className="text-muted-foreground hover:text-foreground transition-colors">
                  Kava Varieties
                </Link>
              </li>
              <li>
                <Link href="/learn/culture" className="text-muted-foreground hover:text-foreground transition-colors">
                  Kava Bar Culture
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookie-policy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="https://instagram.com/mykavabar" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
                >
                  Instagram <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </li>
              <li>
                <a 
                  href="https://facebook.com/mykavabar" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
                >
                  Facebook <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </li>
              <li>
                <a 
                  href="mailto:contact@mykavabar.com" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  contact@mykavabar.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © {currentYear} MyKavaBar. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground flex items-center mt-2 md:mt-0">
            Made with <Heart className="h-3 w-3 mx-1 text-red-500" /> in the USA
          </p>
        </div>
      </div>
    </footer>
  );
}