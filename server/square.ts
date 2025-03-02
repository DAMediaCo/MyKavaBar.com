import { Client, Environment } from "square";
import { type Express } from "express";
import { db } from "@db";
import { sponsoredListings, kavaBars, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { addMonths, addYears } from "date-fns";

if (!process.env.SQUARE_ACCESS_TOKEN) {
  throw new Error("SQUARE_ACCESS_TOKEN must be set");
}

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox // Use Environment.Production for production
});

// Prices for MyKavaBar Certified (in cents)
const CERTIFICATION_PRICE = {
  MONTHLY: BigInt(15900), // $159 per month
  YEARLY: BigInt(172500)  // $1,725 per year
};

export function setupSquareRoutes(app: Express) {
  // Create a payment for MyKavaBar Certification
  app.post("/api/certification/create-payment", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { barId, planType } = req.body;
    if (!barId) {
      return res.status(400).send("Bar ID is required");
    }

    if (!['monthly', 'yearly'].includes(planType)) {
      return res.status(400).send("Invalid plan type. Must be 'monthly' or 'yearly'");
    }

    // Verify bar ownership
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).send("Bar not found");
    }

    if (bar.ownerId !== req.user.id) {
      return res.status(403).send("You don't own this bar");
    }

    try {
      // First, list locations to get the first available location
      const { result: locationResult } = await client.locationsApi.listLocations();

      if (!locationResult.locations?.length) {
        throw new Error("No Square locations found. Please set up a location in your Square account.");
      }

      const locationId = locationResult.locations[0].id;

      // Create a payment link
      const result = await client.checkoutApi.createPaymentLink({
        quickPay: {
          name: `MyKavaBar Certification - ${planType === 'yearly' ? 'Annual' : 'Monthly'} Plan`,
          priceMoney: {
            amount: planType === 'yearly' ? CERTIFICATION_PRICE.YEARLY : CERTIFICATION_PRICE.MONTHLY,
            currency: 'USD'
          },
          locationId
        },
        prePopulatedData: {
          buyerEmail: req.user.username
        },
        note: `MyKavaBar Certification for bar ID: ${barId} - ${planType} plan`,
        orderId: `cert-${barId}-${planType}-${Date.now()}`
      });

      if (result.result.errors?.length) {
        throw new Error(result.result.errors[0].detail);
      }

      const paymentLink = result.result.paymentLink;
      if (!paymentLink?.url || !paymentLink?.id) {
        throw new Error("Failed to create payment link");
      }

      res.json({
        checkoutUrl: paymentLink.url,
        orderId: paymentLink.id
      });
    } catch (error: any) {
      console.error("Square error:", error);
      res.status(500).send(error.message);
    }
  });

  // Webhook handler for successful payments
  app.post("/api/square-webhook", async (req, res) => {
    const { type, data } = req.body;

    try {
      if (type === 'payment.completed') {
        const payment = data.object.payment;
        const orderId = payment.orderId;
        const [_, barId, planType] = orderId.split('-');

        const startDate = new Date();
        const endDate = planType === 'yearly' 
          ? addYears(startDate, 1)
          : addMonths(startDate, 1);

        // Create certification record
        await db.insert(sponsoredListings).values({
          barId: Number(barId),
          squarePaymentId: payment.id,
          startDate,
          endDate,
        });

        // Update bar's certification status
        await db
          .update(kavaBars)
          .set({ isSponsored: true })
          .where(eq(kavaBars.id, Number(barId)));
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Get certification status
  app.get("/api/kava-bars/:id/certification-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const barId = Number(req.params.id);
    const [listing] = await db
      .select()
      .from(sponsoredListings)
      .where(eq(sponsoredListings.barId, barId))
      .limit(1);

    if (!listing) {
      return res.json({ isCertified: false });
    }

    const now = new Date();
    const isActive = now >= listing.startDate && now <= listing.endDate;

    res.json({
      isCertified: isActive,
      startDate: listing.startDate,
      endDate: listing.endDate,
    });
  });
}