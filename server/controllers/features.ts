import { Request, Response } from "express";
import { db } from "@db";
import {
  masterFeatures,
  barFeatures,
  kavaBars,
  barFeaturesFromMaster,
} from "@db/schema";
import { featureCreateSchema, featureUpdateSchema } from "../schema/features";
import { eq, count, and, sql, inArray } from "drizzle-orm";
import {
  staticCategories,
  isValidCategoryId,
} from "../utils/features-categories";

type FeatureType = "master-features" | "custom-features";

const MAX_FEATURE_PER_CATEGORY =
  parseInt(process.env.MAX_FEATURE_PER_CATEGORY!) || 10;

const MAX_FAVORITE_FEATURES = parseInt(process.env.MAX_FAVORITE_FEATURES!) || 5;

const BAR_FEATURE_TYPES = ["master-features", "custom-features"];

export const totalFeaturedFeaturesCount = async (barId: number) => {
  const [totalMasterFeaturedFeatures] = await db
    .select({ count: count() })
    .from(barFeaturesFromMaster)
    .where(
      and(
        eq(barFeaturesFromMaster.barId, barId),
        eq(barFeaturesFromMaster.isFeatured, true),
      ),
    );
  const [totalCustomFeaturedFeatures] = await db
    .select({ count: count() })
    .from(barFeatures)
    .where(and(eq(barFeatures.barId, barId), eq(barFeatures.isFeatured, true)));
  const totalFeaturedFeatures =
    totalMasterFeaturedFeatures.count + totalCustomFeaturedFeatures.count;
  return totalFeaturedFeatures || 0;
};

export const getFeatureById = async (
  featureId: number,
  barId: number,
  userId: number,
  role: string,
  featureType: "master-features" | "custom-features",
) => {
  let feature = null;
  if (role !== "admin") {
    console.log("\n\nRole is not admin ", role);
    const [isOwner] = await db
      .select({ id: kavaBars.id })
      .from(kavaBars)
      .where(and(eq(kavaBars.ownerId, userId), eq(kavaBars.id, barId)));
    if (!isOwner) {
      return null;
    }
  }

  if (featureType === "master-features") {
    [feature] = await db
      .select()
      .from(barFeaturesFromMaster)
      .where(
        and(
          eq(barFeaturesFromMaster.id, featureId),
          eq(barFeaturesFromMaster.barId, barId),
        ),
      );
    console.log("Master feature ", feature);
  } else {
    [feature] = await db
      .select()
      .from(barFeatures)
      .where(and(eq(barFeatures.id, featureId), eq(barFeatures.barId, barId)));
    console.log("Custom feature ", feature);
  }
  console.log("Final feature ", feature);
  return feature;
};

const getTotalFeatureCounts = async (barId: number, categoryId: number) => {
  const [custombarFeatures] = await db
    .select({ count: count() })
    .from(barFeatures)
    .where(
      and(eq(barFeatures.barId, barId), eq(barFeatures.categoryId, categoryId)),
    );
  const [masterBarFeatures] = await db
    .select({ count: count() })
    .from(barFeaturesFromMaster)
    .where(
      and(
        eq(barFeaturesFromMaster.barId, barId),
        eq(barFeaturesFromMaster.featureId, categoryId),
      ),
    );
  const totalFeaturesCount = custombarFeatures.count + masterBarFeatures.count;
  return totalFeaturesCount;
};

// Get categories with feature counts and latest feature preview
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categoriesWithFeatures = await Promise.all(
      staticCategories.map(async (cat) => {
        const latestFeature = await db
          .select()
          .from(masterFeatures)
          .where(eq(masterFeatures.categoryId, cat.id))
          .orderBy(masterFeatures.id)
          .limit(1);

        const countResult = await db
          .select({ count: count() })
          .from(masterFeatures)
          .where(eq(masterFeatures.categoryId, cat.id))
          .execute();

        return {
          id: cat.id,
          name: cat.name,
          featureCount: Number(countResult[0]?.count ?? 0),
          latestFeature: latestFeature[0] || null,
        };
      }),
    );

    console.log("METHOD: GET\n", categoriesWithFeatures);

    res.json(categoriesWithFeatures);
  } catch (error) {
    console.error("getCategories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// Get all features for a category
export const getFeaturesByCategory = async (req: Request, res: Response) => {
  const categoryId = Number(req.params.categoryId);
  if (!isValidCategoryId(categoryId)) {
    return res.status(400).json({ error: "Invalid category ID" });
  }
  try {
    const feats = await db
      .select()
      .from(masterFeatures)
      .where(eq(masterFeatures.categoryId, categoryId))
      .orderBy(masterFeatures.id);
    console.log("METHOD: GET FEATURES BY CAT\n", feats);
    res.json(feats);
  } catch (error) {
    console.error("getFeaturesByCategory error:", error);
    res.status(500).json({ error: "Failed to fetch features" });
  }
};

// Create a new feature
export const createFeature = async (req: Request, res: Response) => {
  const parseResult = featureCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log("Creating feature failed");
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { categoryId, name } = parseResult.data;

  if (!isValidCategoryId(categoryId)) {
    return res.status(400).json({ error: "Invalid category ID" });
  }

  // Assuming user info on req.user
  const userId = (req.user as { id?: number })?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [newFeature] = await db
      .insert(masterFeatures)
      .values({
        categoryId,
        name,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newFeature);
  } catch (error) {
    console.error("createFeature error:", error);
    res.status(500).json({ error: "Failed to create feature" });
  }
};

// Update a feature by ID
export const updateFeature = async (req: Request, res: Response) => {
  const featureId = Number(req.params.featureId);
  if (isNaN(featureId)) {
    return res.status(400).json({ error: "Invalid feature ID" });
  }

  const parseResult = featureUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log("Updating feature failed");
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { name } = parseResult.data;

  try {
    const [existingFeature] = await db
      .select()
      .from(masterFeatures)
      .where(eq(masterFeatures.id, featureId));

    if (!existingFeature) {
      return res.status(404).json({ error: "Feature not found" });
    }

    await db
      .update(masterFeatures)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(masterFeatures.id, featureId));

    const [updatedFeature] = await db
      .select()
      .from(masterFeatures)
      .where(eq(masterFeatures.id, featureId));

    res.json(updatedFeature);
  } catch (error) {
    console.error("updateFeature error:", error);
    res.status(500).json({ error: "Failed to update feature" });
  }
};

// Delete a feature by ID
export const deleteFeature = async (req: Request, res: Response) => {
  const featureId = Number(req.params.featureId);
  if (isNaN(featureId)) {
    return res.status(400).json({ error: "Invalid feature ID" });
  }
  try {
    const deletedCount = await db
      .delete(masterFeatures)
      .where(eq(masterFeatures.id, featureId))
      .returning();

    if (!deletedCount.length)
      return res.status(404).json({ error: "Feature not found" });

    res.status(204).send();
  } catch (error) {
    console.error("deleteFeature error:", error);
    res.status(500).json({ error: "Failed to delete feature" });
  }
};

// Create specific features for bars
export const createBarFeature = async (req: Request, res: Response) => {
  const barId = Number(req.params.barId);
  const parseResult = featureCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log("Creating bar feature failed");
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { categoryId, name } = parseResult.data;

  if (!isValidCategoryId(categoryId)) {
    return res.status(400).json({ error: "Invalid category ID" });
  }

  // Assuming user info on req.user
  const userId = (req.user as { id?: number })?.id;
  const isAdmin = !!(req.user as { isAdmin?: boolean })?.isAdmin;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isAdmin) {
    const [isBarOwner] = await db
      .select({ id: kavaBars.id })
      .from(kavaBars)
      .where(and(eq(kavaBars.ownerId, userId), eq(kavaBars.id, barId)));
    console.log("bar owner ", isBarOwner);
    if (!isBarOwner) return res.status(403).json({ error: "Unauthorized" });
  }
  const [featureExists] = await db
    .select({ id: barFeatures.id })
    .from(barFeatures)
    .where(and(eq(barFeatures.barId, barId), eq(barFeatures.name, name)))
    .limit(1);
  if (featureExists)
    return res.status(409).json({ error: "Feature already exists" });

  const totalFeaturesCount = await getTotalFeatureCounts(barId, categoryId);
  if (totalFeaturesCount >= MAX_FEATURE_PER_CATEGORY) {
    console.log("Feature limit reached");
    return res.status(400).json({ error: "Feature limit reached" });
  }
  try {
    const [newFeature] = await db
      .insert(barFeatures)
      .values({
        categoryId,
        name,
        barId,
        createdBy: userId,
      })
      .returning();
    res.status(201).json(newFeature);
  } catch (error) {
    console.error("createFeature error:", error);
    res.status(500).json({ error: "Failed to create feature" });
  }
};

export const updateBarFeature = async (req: Request, res: Response) => {
  const featureId = Number(req.params.featureId);
  const barId = Number(req.params.barId);

  const parseResult = featureUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log("Updating bar feature failed");
    return res.status(400).json({ error: parseResult.error.flatten() });
  }

  // Assuming user info on req.user
  const userId = (req.user as { id?: number })?.id;
  const isAdmin = !!(req.user as { isAdmin?: boolean })?.isAdmin;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isAdmin) {
    // You should check bar ownership, similar as in create
    const [isBarOwner] = await db
      .select({ id: kavaBars.id })
      .from(kavaBars)
      .where(and(eq(kavaBars.ownerId, userId), eq(kavaBars.id, barId)));
    if (!isBarOwner) return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const [updatedFeature] = await db
      .update(barFeatures)
      .set({
        name: parseResult.data.name,
      })
      .where(and(eq(barFeatures.id, featureId), eq(barFeatures.barId, barId)))
      .returning();
    if (!updatedFeature)
      return res.status(404).json({ error: "Feature not found" });
    res.status(200).json(updatedFeature);
  } catch (error) {
    console.error("updateBarFeature error:", error);
    res.status(500).json({ error: "Failed to update feature" });
  }
};

export const deleteBarFeature = async (req: Request, res: Response) => {
  const barId = Number(req.params.barId) || 0;
  const featureId = Number(req.params.featureId) || 0;

  // Auth check logic
  const userId = (req.user as { id?: number })?.id;
  const isAdmin = !!(req.user as { isAdmin?: boolean })?.isAdmin;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isAdmin) {
    // Bar owner check
    const [isBarOwner] = await db
      .select({ id: kavaBars.id })
      .from(kavaBars)
      .where(and(eq(kavaBars.ownerId, userId), eq(kavaBars.id, barId)));
    if (!isBarOwner) return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const deletedCount = await db
      .delete(barFeatures)
      .where(and(eq(barFeatures.barId, barId), eq(barFeatures.id, featureId)))
      .returning();
    if (!deletedCount.length)
      return res.status(404).json({ error: "Feature not found" });
    res.status(204).send();
  } catch (error) {
    console.error("deleteBarFeature error:", error);
    res.status(500).json({ error: "Failed to delete feature" });
  }
};

export const getOwnerBarFeatures = async (req: Request, res: Response) => {
  const barId = Number(req.params.barId);
  if (isNaN(barId)) {
    return res.status(400).json({ error: "Invalid bar ID" });
  }
  // Auth check logic
  const userId = (req.user as { id?: number })?.id;
  const isAdmin = !!(req.user as { isAdmin?: boolean })?.isAdmin;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isAdmin) {
    // Bar owner check
    const [isBarOwner] = await db
      .select({ id: kavaBars.id })
      .from(kavaBars)
      .where(and(eq(kavaBars.ownerId, userId), eq(kavaBars.id, barId)));
    if (!isBarOwner) return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    // 1. Get all masterFeatures with selected flag (true if barFeaturesFromMaster exists)
    const masterFeaturesWithSelected = await db
      .select({
        id: masterFeatures.id,
        categoryId: masterFeatures.categoryId,
        selected: sql<boolean>`CASE WHEN ${barFeaturesFromMaster.id} IS NOT NULL THEN true ELSE false END`,
        featureId: barFeaturesFromMaster.id, // Add this line
        isFeatured: barFeaturesFromMaster.isFeatured, // Add this line
        name: masterFeatures.name,
      })
      .from(masterFeatures)
      .leftJoin(
        barFeaturesFromMaster,
        and(
          eq(masterFeatures.id, barFeaturesFromMaster.featureId),
          eq(barFeaturesFromMaster.barId, barId),
        ),
      )
      .orderBy(masterFeatures.id);
    console.log("Master features selected ", masterFeaturesWithSelected);
    // 2. Get bar's custom features
    const customFeaturesForBar = await db
      .select({
        id: barFeatures.id,
        categoryId: barFeatures.categoryId,
        name: barFeatures.name,
        isFeatured: barFeatures.isFeatured,
        createdAt: barFeatures.createdAt,
      })
      .from(barFeatures)
      .where(eq(barFeatures.barId, barId))
      .orderBy(barFeatures.id);
    return res.json({
      masterFeatures: masterFeaturesWithSelected,
      customFeatures: customFeaturesForBar,
    });
  } catch (error) {
    console.error("getBarFeaturesFull error:", error);
    return res.status(500).json({ error: "Failed to fetch features" });
  }
};

export const getBarFeatures = async (req: Request, res: Response) => {
  const barId = Number(req.params.barId);
  if (isNaN(barId)) {
    return res.status(400).json({ error: "Invalid bar ID" });
  }
  try {
    const masterFeaturesWithSelected = await db
      .select({
        id: masterFeatures.id,
        categoryId: masterFeatures.categoryId,
        name: masterFeatures.name,
        isFeatured: barFeaturesFromMaster.isFeatured, // Add this line
      })
      .from(masterFeatures)
      .innerJoin(
        barFeaturesFromMaster,
        and(
          eq(masterFeatures.id, barFeaturesFromMaster.featureId),
          eq(barFeaturesFromMaster.barId, barId),
        ),
      )
      .orderBy(masterFeatures.id);

    const customFeaturesForBar = await db
      .select({
        id: barFeatures.id,
        categoryId: barFeatures.categoryId,
        name: barFeatures.name,
        isFeatured: barFeatures.isFeatured,
        createdAt: barFeatures.createdAt,
      })
      .from(barFeatures)
      .where(eq(barFeatures.barId, barId))
      .orderBy(barFeatures.id);

    return res.json({
      masterFeatures: masterFeaturesWithSelected,
      customFeatures: customFeaturesForBar,
    });
  } catch (error) {
    console.error("getBarFeatures error:", error);
    return res.status(500).json({ error: "Failed to fetch" });
  }
};

export const updateMasterFeaturesForBarOwner = async (
  req: Request,
  res: Response,
) => {
  const barId = Number(req.params.barId);
  const { categoryId, featureIds } = req.body;
  console.log("\n\nRequest received for features updated");
  if (!barId || !categoryId || !Array.isArray(featureIds)) {
    return res.status(400).json({
      error: "Invalid input: barId, categoryId and featureIds are required.",
    });
  }

  try {
    const totalFeaturesCount = await getTotalFeatureCounts(barId, categoryId);
    if (totalFeaturesCount >= MAX_FEATURE_PER_CATEGORY) {
      console.log("Feature limit reached");
      return res.status(400).json({ error: "Feature limit reached" });
    }
    // Fetch all master feature IDs in the category
    const masterFeaturesInCategory = await db
      .select({ id: masterFeatures.id })
      .from(masterFeatures)
      .where(eq(masterFeatures.categoryId, categoryId));

    const validFeatureIds = new Set(masterFeaturesInCategory.map((f) => f.id));

    // Filter featureIds to valid ones for the category
    const filteredFeatureIds = featureIds.filter((id) =>
      validFeatureIds.has(id),
    );

    // Fetch currently selected feature IDs for this bar and category
    const selectedFeaturesForBar = await db
      .select({ featureId: barFeaturesFromMaster.featureId })
      .from(barFeaturesFromMaster)
      .where(
        and(
          eq(barFeaturesFromMaster.barId, barId),
          inArray(
            barFeaturesFromMaster.featureId,
            masterFeaturesInCategory.map((f) => f.id),
          ),
        ),
      );

    const currentlySelectedFeatureIds = new Set(
      selectedFeaturesForBar.map((f) => f.featureId),
    );

    // Determine which features to add and remove
    const featuresToAdd = filteredFeatureIds.filter(
      (id) => !currentlySelectedFeatureIds.has(id),
    );
    const featuresToRemove = Array.from(currentlySelectedFeatureIds).filter(
      (id) => !filteredFeatureIds.includes(id),
    );

    // Delete features to remove
    if (featuresToRemove.length > 0) {
      await db
        .delete(barFeaturesFromMaster)
        .where(
          and(
            eq(barFeaturesFromMaster.barId, barId),
            inArray(barFeaturesFromMaster.featureId, featuresToRemove),
          ),
        );
    }

    // Insert features to add
    if (featuresToAdd.length > 0) {
      await db.insert(barFeaturesFromMaster).values(
        featuresToAdd.map((featureId) => ({
          barId,
          featureId,
        })),
      );
    }

    return res.status(200).json({
      success: true,
      addedFeatureIds: featuresToAdd,
      removedFeatureIds: featuresToRemove,
    });
  } catch (error) {
    console.error("Error updating master features for category:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleFavoriteFeatures = async (req: Request, res: Response) => {
  try {
    if (!req.isAuthenticated() || !req.user || !req.user.id)
      return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.user;
    const { featureId, barId } = req.params;
    const { type } = req.query;
    if (!BAR_FEATURE_TYPES.includes(type as string))
      return res.status(400).json({ error: "Invalid feature type" });
    const featureType = type as FeatureType;
    console.log("\n\nUser role ", req.user.role);

    const feature = await getFeatureById(
      parseInt(featureId),
      parseInt(barId),
      id,
      req.user.role || "regular_user",
      featureType,
    );
    if (!feature) return res.status(404).json({ error: "Feature not found" });

    if (feature.isFeatured) {
      console.log("Feature is already featured");
      if (type === "master-features")
        await db
          .update(barFeaturesFromMaster)
          .set({ isFeatured: false })
          .where(eq(barFeaturesFromMaster.id, parseInt(featureId)));
      else
        await db
          .update(barFeatures)
          .set({ isFeatured: false })
          .where(eq(barFeatures.id, parseInt(featureId)));
    } else {
      const totalFeaturedFeatures = await totalFeaturedFeaturesCount(
        parseInt(barId),
      );
      if (totalFeaturedFeatures >= MAX_FAVORITE_FEATURES)
        return res
          .status(400)
          .json({ error: "Favorite features limit reached" });
      if (type === "master-features")
        await db
          .update(barFeaturesFromMaster)
          .set({ isFeatured: true })
          .where(eq(barFeaturesFromMaster.id, parseInt(featureId)));
      else
        await db
          .update(barFeatures)
          .set({ isFeatured: true })
          .where(eq(barFeatures.id, parseInt(featureId)));
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.log("ERROR WHILE TOGGLING FEATURES", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
