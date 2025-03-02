import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { crypto } from "./utils/crypto";

async function setupAdmin() {
  const username = "M3PDave";
  const password = "!Tnd12281216";
  const email = "admin@mykavabars.com";

  try {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser) {
      // Update existing user
      const hashedPassword = await crypto.hash(password);
      await db
        .update(users)
        .set({
          password: hashedPassword,
          isAdmin: true,
          email: email,
        })
        .where(eq(users.id, existingUser.id));

      console.log("Admin user updated successfully");
    } else {
      // Create new admin user
      const hashedPassword = await crypto.hash(password);
      await db.insert(users).values({
        username,
        password: hashedPassword,
        isAdmin: true,
        email: email,
      });

      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error setting up admin user:", error);
    throw error;
  }
}

setupAdmin().catch(console.error);