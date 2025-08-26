import { Request, Response } from "express";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

const TIME_REGEX = /^(0?[1-9]|1[0-2]):([0-5][0-9])$/;

const happyHourSlotSchema = z.object({
  start: z
    .string()
    .regex(TIME_REGEX, "Start time must be in hh:mm 0-11 format"),
  startPeriod: z.enum(["AM", "PM"]),
  end: z.string().regex(TIME_REGEX, "End time must be in hh:mm 0-11 format"),
  endPeriod: z.enum(["AM", "PM"]),
});

const happyHoursDaySchema = z
  .array(happyHourSlotSchema)
  .max(4, "Max 4 happy hour slots per day");

const happyHoursSchema = z.record(happyHoursDaySchema).refine(
  (data) => {
    return Object.values(data).every((slots) =>
      slots.every(
        (slot) =>
          (slot.start !== "" && slot.end !== "") ||
          (slot.start === "" && slot.end === ""),
      ),
    );
  },
  {
    message:
      "Both start and end times must be filled or both left empty in every slot",
  },
);

export async function updateHappyHoursController(req: Request, res: Response) {
  try {
    // Validate input
    const parsed = happyHoursSchema.parse(req.body.happyHours);

    // Filter out empty slots per day and days with no filled slots
    const filteredHappyHours = Object.fromEntries(
      Object.entries(parsed)
        .map(([day, slots]) => [
          day,
          slots.filter((slot) => slot.start !== "" && slot.end !== ""),
        ])
        .filter(([_, slots]) => slots.length > 0),
    );
    console.log("\n\nhappy hours ", filteredHappyHours);
    await db
      .update(kavaBars)
      .set({ happyHours: filteredHappyHours })
      .where(eq(kavaBars.id, parseInt(req.params.barId)));

    return res
      .status(200)
      .json({ message: "Happy hours updated successfully" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      // Send user-friendly validation errors
      return res.status(400).json({
        message: "Validation error",
        errors: e.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
      });
    }
    console.error("Update happy hours error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getHappyHoursController(req: Request, res: Response) {
  try {
    const kavaBarId = Number(req.params.barId);
    if (isNaN(kavaBarId)) {
      return res.status(400).json({ message: "Invalid kava bar ID" });
    }

    // Fetch the hours JSONB column from the DB for the given kava bar ID
    const bar = await db
      .select({ happyHours: kavaBars.happyHours })
      .from(kavaBars)
      .where(eq(kavaBars.id, kavaBarId))
      .limit(1)
      .execute()
      .then((rows) => rows[0]);

    if (!bar) {
      return res.status(404).json({ message: "Kava bar not found" });
    }

    console.log("\n\nbar ", bar);

    // Extract happyHours object or return empty structure
    const happyHours = bar.happyHours || {};
    console.log("\n\nHappy hours ", happyHours);
    return res.status(200).json({ happyHours });
  } catch (error) {
    console.error("Error fetching happy hours:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
