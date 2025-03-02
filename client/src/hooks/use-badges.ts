import { useMemo } from 'react';
import type { User } from '@db/schema';

export interface Badge {
  title: string;
  description: string;
  icon: string;
  color: string;
  required: number;
}

const BADGES: Badge[] = [
  {
    title: "Kava Newbie",
    description: "Welcome to the world of Kava!",
    icon: "🌱",
    color: "text-green-500",
    required: 0
  },
  {
    title: "Kava Explorer",
    description: "You're getting familiar with Kava culture",
    icon: "🔍",
    color: "text-blue-500",
    required: 51
  },
  {
    title: "Kava Enthusiast",
    description: "Your Kava journey is well underway",
    icon: "⭐",
    color: "text-yellow-500",
    required: 101
  },
  {
    title: "Kava Master",
    description: "A true Kava connoisseur",
    icon: "👑",
    color: "text-purple-500",
    required: 201
  }
];

export function useBadges(user: User | null) {
  return useMemo(() => {
    if (!user) return [];
    
    const points = user.points || 0;
    return BADGES.filter(badge => points >= badge.required);
  }, [user?.points]);
}

export function useNextBadge(user: User | null) {
  return useMemo(() => {
    if (!user) return null;
    
    const points = user.points || 0;
    return BADGES.find(badge => points < badge.required);
  }, [user?.points]);
}
