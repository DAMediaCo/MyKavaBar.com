import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center space-x-2">
      <Sun className={`h-[1.2rem] w-[1.2rem] ${theme === 'dark' ? 'text-muted-foreground' : 'text-foreground'}`} />
      <Switch
        checked={theme === "dark"}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Toggle theme"
      />
      <Moon className={`h-[1.2rem] w-[1.2rem] ${theme === 'dark' ? 'text-foreground' : 'text-muted-foreground'}`} />
    </div>
  );
}