import { db } from "@db"; // Your database client
import { users } from "@db/schema"; // Your users table schema
import { eq } from "drizzle-orm";

export async function usernameExists(username: string): Promise<boolean> {
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  return result.length > 0;
}

function getRandomNumber() {
  return Math.floor(100 + Math.random() * 900).toString();
}

export async function generateUsernameSuggestions(
  firstName: string,
  lastName: string,
  count = 3,
): Promise<string[]> {
  const suggestions = new Set<string>();
  const maxAttempts = 30;
  let attempts = 0;

  const fName = firstName.toLowerCase();
  const lName = lastName.toLowerCase();

  while (suggestions.size < count && attempts < maxAttempts) {
    attempts++;

    const randNum1 = getRandomNumber();
    const randNum2 = getRandomNumber();
    const randNum3 = getRandomNumber();

    const s1 = fName && lName ? `${fName[0]}${lName}${randNum1}` : null;
    const s2 = fName && lName ? `${fName}${lName}${randNum2}` : null;
    let s3: string | null = null;

    if (fName && lName) {
      const part1 = fName.length >= 3 ? fName.slice(0, 3) : fName;
      const part2 = lName.length >= 3 ? lName.slice(-3) : lName;
      s3 = `${part1}${part2}${randNum3}`;
    }

    for (const username of [s1, s2, s3]) {
      if (username && !(await usernameExists(username))) {
        suggestions.add(username);
        if (suggestions.size === count) break;
      }
    }
  }

  return Array.from(suggestions);
}
