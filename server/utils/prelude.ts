import { Prelude } from "@prelude.so/sdk";
import { formatToE164 } from "./phone-format";

// Initialize Prelude client with better error handling
let preludeClient: Prelude | null = null;

function getPreludeClient(): Prelude {
  if (!preludeClient) {
    const token = process.env.PRELUDE_API_TOKEN;
    if (!token) {
      console.error("PRELUDE_API_TOKEN environment variable is missing");
      throw new Error("PRELUDE_API_TOKEN environment variable must be set");
    }
    preludeClient = new Prelude({
      apiToken: token,
      timeout: 30000, // 30 second timeout
    });
  }
  return preludeClient;
}

export async function sendVerificationCode(phoneNumber: string) {
  try {
    console.log("Starting verification process for:", phoneNumber);

    // Format phone number strictly to E.164
    const formattedNumber = formatToE164(phoneNumber);
    console.log("Formatted phone number for verification:", formattedNumber);

    // Get or initialize the client
    const prelude = getPreludeClient();

    // Create verification with required parameters
    console.log("Sending verification request to Prelude...");
    const verification = await prelude.verification.create({
      target: {
        type: "phone_number",
        value: formattedNumber,
      },
      method: "text",
      options: {
        locale: "en-US",
      },
    });

    console.log("Raw Prelude response:", JSON.stringify(verification, null, 2));

    if (!verification?.id) {
      console.error(
        "Invalid verification response - missing ID:",
        verification,
      );
      throw new Error("Invalid verification response from service");
    }

    console.log("Successfully created verification with ID:", verification.id);
    return {
      success: true,
      verificationId: verification.id,
    };
  } catch (error: any) {
    console.error("Verification error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack,
    });

    let errorMessage = "Failed to send verification code";
    if (error.response?.status === 401) {
      errorMessage = "Authentication failed with verification service";
    } else if (error.response?.status === 400) {
      errorMessage = "Invalid phone number format";
    }

    return {
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  }
}

export async function verifyCode(phoneNumber: string, code: string) {
  try {
    console.log("Starting code verification process:", {
      phoneNumber,
      code: "****",
    });

    // Get or initialize the client
    const prelude = getPreludeClient();

    console.log("Phone Number", phoneNumber);
    const result = await prelude.verification.check({
      code: code,
      target: { type: "phone_number", value: phoneNumber },
    });

    console.log("Verification check result:", result);

    if (!result || typeof result.status !== "string") {
      console.error("Invalid verification response structure:", result);
      throw new Error("Invalid response from verification service");
    }

    console.log("Result:", result);
    return {
      success: true,
      verified: result.status === "verified" || result.status === "success",
    };
  } catch (error: any) {
    console.error("Code verification error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack,
    });

    let errorMessage = "Failed to verify code";
    if (error.response?.status === 401) {
      errorMessage = "Authentication failed with verification service";
    } else if (error.response?.status === 404) {
      errorMessage = "Verification code not found or expired";
    } else if (error.response?.status === 429) {
      errorMessage =
        "Too many verification attempts. Please wait and try again.";
    }

    return {
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  }
}
