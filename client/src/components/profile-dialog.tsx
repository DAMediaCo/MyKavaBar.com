import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useBadges, useNextBadge } from "@/hooks/use-badges";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@db/schema";

interface ProfileDialogProps {
  user: User;
  trigger: React.ReactNode;
}

export default function ProfileDialog({ user, trigger }: ProfileDialogProps) {
  const badges = useBadges(user);
  const nextBadge = useNextBadge(user);

  const progress = nextBadge 
    ? ((user.points || 0) / nextBadge.required) * 100
    : 100;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile & Achievements</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Your Badges</h4>
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {badges.map((badge, index) => (
                  <motion.div
                    key={badge.title}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg border bg-card text-card-foreground"
                  >
                    <motion.div 
                      className="text-2xl mb-2"
                      animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      {badge.icon}
                    </motion.div>
                    <h3 className={`text-sm font-medium ${badge.color}`}>
                      {badge.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {badge.description}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {nextBadge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h4 className="text-sm font-medium mb-3">Next Badge</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={nextBadge.color}>
                    {nextBadge.icon} {nextBadge.title}
                  </span>
                  <span>
                    {user.points || 0} / {nextBadge.required} points
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}