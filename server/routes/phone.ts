import { Router } from "express";
import { db } from "@db";
import { users, phoneVerificationCodes } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendVerificationCode, verifyCode } from "../utils/prelude";
import { formatToE164 } from "../utils/phone-format";

const router = Router();

// Request phone verification code
router.post("/api/phone/verify", async (req, res) => {
  try {
    const body = req.body;
    console.log("Received request to verify phone number:", body);
    const { phoneNumber } = body;
    console.log("Received verification request for:", phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Format and validate phone number
    let formattedNumber;
    try {
      formattedNumber = formatToE164(phoneNumber);
      console.log("Formatted number:", formattedNumber);

      if (!formattedNumber.match(/^\+1[2-9]\d{9}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be a valid US number.",
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
        details: error.message,
      });
    }

    // Delete any existing unverified codes
    await db
      .delete(phoneVerificationCodes)
      .where(
        and(
          eq(phoneVerificationCodes.phoneNumber, formattedNumber),
          eq(phoneVerificationCodes.isUsed, false),
        ),
      );

    console.log("Sending verification code...");
    const verificationResult = await sendVerificationCode(formattedNumber);
    console.log("Verification result:", verificationResult);

    if (!verificationResult.success) {
      console.error("Failed to send verification:", verificationResult.error);
      return res.status(503).json({
        success: false,
        message: verificationResult.error,
        details:
          process.env.NODE_ENV === "development"
            ? verificationResult.details
            : undefined,
      });
    }

    // Store verification record
    const [verificationRecord] = await db
      .insert(phoneVerificationCodes)
      .values({
        phoneNumber: formattedNumber,
        verificationId: verificationResult.verificationId,
        type: "signup",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isUsed: false,
      })
      .returning();

    console.log("Created verification record:", verificationRecord.id);
    res.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error: any) {
    console.error("Error in phone verification:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process verification request. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Verify phone number with code
router.post("/api/phone/confirm", async (req, res) => {
  try {
    const { code, phoneNumber } = req.body;
    console.log("Received confirmation request:", {
      phoneNumber,
      code: "****",
    });

    if (!code || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Verification code and phone number are required",
      });
    }

    let formattedNumber;
    try {
      formattedNumber = formatToE164(phoneNumber);
      if (!formattedNumber.match(/^\+1[2-9]\d{9}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format. Must be a valid US number.",
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
        details: error.message,
      });
    }

    // Get the most recent verification code
    const [verificationRecord] = await db
      .select()
      .from(phoneVerificationCodes)
      .where(
        and(
          eq(phoneVerificationCodes.phoneNumber, formattedNumber),
          eq(phoneVerificationCodes.isUsed, false),
        ),
      )
      .orderBy(desc(phoneVerificationCodes.createdAt))
      .limit(1);

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired verification attempt. Please request a new code.",
      });
    }

    console.log("Found verification record:", verificationRecord.id);

    // Verify code
    const verificationResult = await verifyCode(formattedNumber, code);
    console.log("Verification result:", verificationResult);

    if (!verificationResult.success) {
      return res.status(503).json({
        success: false,
        message: verificationResult.error,
        details: verificationResult.details,
      });
    }

    if (!verificationResult.verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code. Please try again.",
      });
    }

    // Mark code as used
    await db
      .update(phoneVerificationCodes)
      .set({ isUsed: true })
      .where(eq(phoneVerificationCodes.id, verificationRecord.id));

    // If user is authenticated, update their phone verification status
    if (req.user?.id) {
      await db
        .update(users)
        .set({
          phoneNumber: formattedNumber,
          isPhoneVerified: true,
        })
        .where(eq(users.id, req.user.id));
    }

    res.json({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (error: any) {
    console.error("Error in confirmation:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process verification. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
