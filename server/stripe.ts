import Stripe from "stripe";
import { type Express } from "express";
import { db } from "@db";
import { sponsoredListings, kavaBars, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { addMonths } from "date-fns";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY must be set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Price for sponsored listing (in cents)
const SPONSORED_LISTING_PRICE = 2999; // $29.99 per month

export function setupStripeRoutes(app: Express) {
  // Create a payment intent for sponsored listing
  app.post("/api/sponsored-listing/create-payment", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const { barId } = req.body;
    if (!barId) {
      return res.status(400).send("Bar ID is required");
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
      // Create or get Stripe customer
      let customerId = req.user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.username,
          metadata: {
            userId: req.user.id.toString(),
          },
        });
        customerId = customer.id;

        // Save customer ID
        await db
          .update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, req.user.id));
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: SPONSORED_LISTING_PRICE,
        currency: "usd",
        customer: customerId,
        metadata: {
          barId: barId.toString(),
          userId: req.user.id.toString(),
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).send(error.message);
    }
  });

  // Webhook handler for successful payments
  app.post("/api/stripe-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).send("No signature");
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const barId = Number(paymentIntent.metadata.barId);
        const startDate = new Date();
        const endDate = addMonths(startDate, 1);

        // Create sponsored listing record
        await db.insert(sponsoredListings).values({
          barId,
          stripePaymentId: paymentIntent.id,
          startDate,
          endDate,
        });

        // Update bar's sponsored status
        await db
          .update(kavaBars)
          .set({ isSponsored: true })
          .where(eq(kavaBars.id, barId));
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Get sponsored listing status
  app.get("/api/kava-bars/:id/sponsored-status", async (req, res) => {
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
      return res.json({ isSponsored: false });
    }

    const now = new Date();
    const isActive = now >= listing.startDate && now <= listing.endDate;

    res.json({
      isSponsored: isActive,
      startDate: listing.startDate,
      endDate: listing.endDate,
    });
  });
}