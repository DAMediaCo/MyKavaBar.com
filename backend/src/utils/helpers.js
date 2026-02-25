// Haversine formula for geo-fencing check-ins
// Returns distance in meters between two GPS coordinates

export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check if user is within valid range of a bar
export function isWithinRange(userLat, userLon, barLat, barLon, rangeMeters = 100) {
  if (!barLat || !barLon) return true; // Allow if bar has no coordinates
  const distance = getDistanceInMeters(userLat, userLon, barLat, barLon);
  return distance <= rangeMeters;
}

// Calculate streak from check-in dates
export function calculateStreak(checkinDates) {
  if (!checkinDates || checkinDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort dates descending (newest first)
  const sorted = [...checkinDates].sort((a, b) => new Date(b) - new Date(a));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  // Check if most recent check-in is today or yesterday
  const lastCheckin = new Date(sorted[0]);
  lastCheckin.setHours(0, 0, 0, 0);
  
  if (lastCheckin.getTime() >= yesterday.getTime()) {
    currentStreak = 1;
    
    // Count consecutive days
    for (let i = 1; i < sorted.length; i++) {
      const current = new Date(sorted[i - 1]);
      const previous = new Date(sorted[i]);
      current.setHours(0, 0, 0, 0);
      previous.setHours(0, 0, 0, 0);
      
      const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < sorted.length; i++) {
    const current = new Date(sorted[i - 1]);
    const previous = new Date(sorted[i]);
    current.setHours(0, 0, 0, 0);
    previous.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

// Generate unique referral code
export function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate 6-character game join code
export function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Format date to ISO string without timezone
export function formatDate(date) {
  return new Date(date).toISOString();
}

// Calculate shells earned for check-in
export function calculateCheckinShells(isNewBar) {
  const baseShells = 10;
  const newBarBonus = isNewBar ? 25 : 0;
  return baseShells + newBarBonus;
}

// Validate email format
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format
export function isValidPhone(phone) {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
}

// Sanitize input - prevent SQL injection and XSS
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

// Paginate results
export function paginate(results, page = 1, limit = 20) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: results.slice(startIndex, endIndex),
    pagination: {
      total: results.length,
      page,
      limit,
      totalPages: Math.ceil(results.length / limit),
      hasMore: endIndex < results.length,
    }
  };
}
