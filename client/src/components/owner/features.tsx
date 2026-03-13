"use client";
import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FaStar, FaRegStar } from "react-icons/fa";

type Feature = {
  id: number;
  name: string;
  categoryId: number;
  isFeatured?: boolean;
};
type MasterFeature = Feature & {
  selected: boolean;
};
type Category = {
  id: number;
  name: string;
};
const categoriesDummy: Category[] = [
  { id: 1, name: "Tech & Connectivity" },
  { id: 2, name: "Entertainment" },
  { id: 3, name: "Seating & Environment" },
  { id: 4, name: "Events & Community" },
  { id: 5, name: "Food & Drink" },
  { id: 6, name: "Merch & Loyalty" },
];
// Validation schema with Zod
const featureSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Feature name must be at least 2 characters long")
    .max(50, "Feature name must not exceed 50 characters"),
});
type FeatureFormInput = z.infer<typeof featureSchema>;
interface FeaturesProps {
  barId: number;
}
interface FeatureStarProps {
  isFeatured: boolean;
  disabled: boolean;
  onToggle: () => void;
}
const FeatureStar: React.FC<FeatureStarProps> = ({
  isFeatured,
  disabled,
  onToggle,
}) => {
  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onToggle();
      }}
      aria-label={isFeatured ? "Unmark as favorite" : "Mark as favorite"}
      className={`focus:outline-none ml-2 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
      type="button"
    >
      {isFeatured ? <FaStar className="text-yellow-400" /> : <FaRegStar />}
    </button>
  );
};

export const Features: React.FC<FeaturesProps> = ({ barId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [masterFeaturesByCategory, setMasterFeaturesByCategory] = useState<
    Record<number, MasterFeature[]>
  >({});
  const [customFeaturesByCategory, setCustomFeaturesByCategory] = useState<
    Record<number, Feature[]>
  >({});
  const [selectedMasterFeatures, setSelectedMasterFeatures] = useState<
    Record<number, Set<number>>
  >({});
  const [editingFeature, setEditingFeature] = useState<{
    categoryId: number | null;
    featureId: number | null;
    name: string | null;
  }>({ categoryId: null, featureId: null, name: null });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    categoryId: number | null;
    featureId: number | null;
    featureName: string | null;
  }>({ open: false, categoryId: null, featureId: null, featureName: null });
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);

  // Holds active debouncing timers per category
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["barFeaturesFull", barId],
    queryFn: async () => {
      const res = await axios.get(`/api/bar/${barId}/owner/features`, {
        withCredentials: true,
      });
      const masterGrouped: Record<number, MasterFeature[]> = {};
      res.data.masterFeatures.forEach((f: MasterFeature) => {
        if (!masterGrouped[f.categoryId]) masterGrouped[f.categoryId] = [];
        masterGrouped[f.categoryId].push(f);
      });
      const customGrouped: Record<number, Feature[]> = {};
      res.data.customFeatures.forEach((f: Feature) => {
        if (!customGrouped[f.categoryId]) customGrouped[f.categoryId] = [];
        customGrouped[f.categoryId].push(f);
      });
      const selectedMap: Record<number, Set<number>> = {};
      res.data.masterFeatures.forEach((feature: MasterFeature) => {
        if (!selectedMap[feature.categoryId])
          selectedMap[feature.categoryId] = new Set();
        if (feature.selected) selectedMap[feature.categoryId].add(feature.id);
      });
      setMasterFeaturesByCategory(masterGrouped);
      setCustomFeaturesByCategory(customGrouped);
      setSelectedMasterFeatures(selectedMap);
      return {
        masterFeatures: res.data.masterFeatures,
        customFeatures: res.data.customFeatures,
        selectedMasterFeaturesMap: selectedMap,
      };
    },
  });

  const { control, handleSubmit, reset, formState } = useForm<FeatureFormInput>(
    {
      resolver: zodResolver(featureSchema),
      mode: "onSubmit",
      defaultValues: { name: "" },
    },
  );
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (
      editingFeature.categoryId !== null &&
      editingFeature.featureId !== null
    ) {
      const featureToEdit = customFeaturesByCategory[
        editingFeature.categoryId
      ]?.find((f) => f.id === editingFeature.featureId);
      if (featureToEdit) {
        reset({ name: featureToEdit.name });
        setFormCategoryId(editingFeature.categoryId);
      }
    } else {
      reset({ name: "" });
      setFormCategoryId(null);
    }
  }, [editingFeature, customFeaturesByCategory, reset]);

  // Mutations for create/update/delete custom features
  const createCustomFeatureMutation = useMutation({
    mutationFn: (payload: {
      barId: number;
      categoryId: number;
      name: string;
    }) =>
      axios.post(`/api/bar/${payload.barId}/features`, payload, {
        withCredentials: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barFeaturesFull", barId] });
      setEditingFeature({ categoryId: null, featureId: null, name: null });
      reset({ name: "" });
      toast({ title: "Success", description: "Feature added successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to add feature.",
        variant: "destructive",
      });
    },
  });
  const updateCustomFeatureMutation = useMutation({
    mutationFn: (payload: {
      barId: number;
      name: string;
      featureId: number;
      categoryId: number;
    }) =>
      axios.put(
        `/api/bar/${payload.barId}/features/${payload.featureId}`,
        { name: payload.name },
        { withCredentials: true },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barFeaturesFull", barId] });
      setEditingFeature({ categoryId: null, featureId: null, name: null });
      reset({ name: "" });
      toast({ title: "Updated", description: "Feature updated successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error?.response?.data?.error || "Failed to update feature.",
        variant: "destructive",
      });
    },
  });
  const deleteCustomFeatureMutation = useMutation({
    mutationFn: (payload: {
      barId: number;
      featureId: number;
      categoryId: number;
    }) =>
      axios.delete(`/api/bar/${payload.barId}/features/${payload.featureId}`, {
        withCredentials: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barFeaturesFull", barId] });
      setDeleteDialog({
        open: false,
        categoryId: null,
        featureId: null,
        featureName: null,
      });
      toast({ title: "Deleted", description: "Feature deleted successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error?.response?.data?.error || "Failed to delete feature.",
        variant: "destructive",
      });
      setDeleteDialog({
        open: false,
        categoryId: null,
        featureId: null,
        featureName: null,
      });
    },
  });
  // Bulk update mutation for master features per category (will be called via debounce)
  const updateMasterFeaturesMutation = useMutation({
    mutationFn: (payload: {
      barId: number;
      categoryId: number;
      featureIds: number[];
    }) =>
      axios.put(
        `/api/bar/${payload.barId}/features/from-master`,
        { name: "test", ...payload },
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barFeaturesFull", barId] });
      toast({
        title: "Success",
        description: "Master features updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update master features.",
        variant: "destructive",
      });
    },
  });

  // Mutation for toggling isFeatured
  const toggleFeaturedMutation = useMutation({
    mutationFn: (payload: {
      featureId: number;
      barId: number;
      type: "master-features" | "custom-features";
    }) =>
      axios.put(
        `/api/bar/${payload.barId}/features/${payload.featureId}/toggle-isFeatured`,
        null,
        {
          params: { type: payload.type },
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barFeaturesFull", barId] });
      toast({ title: "Success", description: "Feature favorite toggled." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to toggle favorite feature.",
        variant: "destructive",
      });
    },
  });

  const isBusy =
    isSubmitting ||
    createCustomFeatureMutation.isPending ||
    updateCustomFeatureMutation.isPending ||
    deleteCustomFeatureMutation.isPending ||
    updateMasterFeaturesMutation.isPending ||
    toggleFeaturedMutation.isPending;

  // Count total featured features (master + custom)
  const totalFeaturedCount = React.useMemo(() => {
    let count = 0;
    data?.masterFeatures?.forEach((f: MasterFeature) => {
      if (f.isFeatured) count++;
    });
    data?.customFeatures?.forEach((f: Feature) => {
      if (f.isFeatured) count++;
    });
    return count;
  }, [data]);
  const canToggleMore = totalFeaturedCount < 5;

  // Handlers
  const handleDeleteClick = (categoryId: number, feature: Feature) => {
    setDeleteDialog({
      open: true,
      categoryId,
      featureId: feature.id,
      featureName: feature.name,
    });
  };

  const confirmDelete = () => {
    if (deleteDialog.categoryId && deleteDialog.featureId) {
      deleteCustomFeatureMutation.mutate({
        barId,
        featureId: deleteDialog.featureId,
        categoryId: deleteDialog.categoryId,
      });
    }
  };
  const startEditCustomFeature = (categoryId: number, feature: Feature) => {
    setEditingFeature({
      categoryId,
      featureId: feature.id,
      name: feature.name,
    });
    reset({ name: feature.name });
    setFormCategoryId(categoryId);
  };
  const cancelEdit = () => {
    setEditingFeature({ categoryId: null, featureId: null, name: null });
    setFormCategoryId(null);
    reset({ name: "" });
  };
  const onSubmit: SubmitHandler<FeatureFormInput> = (dataForm) => {
    if (!formCategoryId) return;
    const featuresCount = customFeaturesByCategory[formCategoryId]?.length ?? 0;
    const isEditing =
      editingFeature.categoryId === formCategoryId &&
      editingFeature.featureId !== null;
    if (!isEditing && featuresCount >= 10) {
      toast({
        title: "Limit Reached",
        description:
          "You can add a maximum of 10 custom features per category.",
        variant: "destructive",
      });
      return;
    }
    if (isEditing && editingFeature.featureId) {
      updateCustomFeatureMutation.mutate({
        barId,
        name: dataForm.name,
        featureId: editingFeature.featureId,
        categoryId: formCategoryId,
      });
    } else {
      createCustomFeatureMutation.mutate({
        barId,
        categoryId: formCategoryId,
        name: dataForm.name,
      });
    }
  };

  // DEBOUNCED API CALL for master feature selection!
  const handleMasterFeatureCheckboxChange = (
    categoryId: number,
    featureId: number,
    checked: boolean,
  ) => {
    setSelectedMasterFeatures((prev) => {
      const newSet = new Set(prev[categoryId] || []);
      if (checked) {
        newSet.add(featureId);
      } else {
        newSet.delete(featureId);
      }
      return { ...prev, [categoryId]: newSet };
    });

    // Clear previous timer if exists
    if (debounceTimers.current[categoryId]) {
      clearTimeout(debounceTimers.current[categoryId]);
    }
    // Start new debounce timer (500ms)
    debounceTimers.current[categoryId] = setTimeout(() => {
      // Use latest selected features (from state AFTER update)
      setSelectedMasterFeatures((curr) => {
        const selectedFeatureIds = Array.from(curr[categoryId] || []);
        updateMasterFeaturesMutation.mutate({
          barId,
          categoryId,
          featureIds: selectedFeatureIds,
        });
        return curr;
      });
    }, 500);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-6 text-black dark:text-white">
        Manage Features
      </h1>
      {categoriesDummy.map((category) => {
        const masterFeatures =
          data?.masterFeatures.filter(
            (f: MasterFeature) => f.categoryId === category.id,
          ) ?? [];
        const customFeatures =
          data?.customFeatures.filter(
            (f: Feature) => f.categoryId === category.id,
          ) ?? [];
        const masterSelectedCount =
          data?.masterFeatures?.filter(
            (f: MasterFeature) => f.selected && f.categoryId === category.id,
          ).length ?? 0;
        const customFeaturesCount =
          data?.customFeatures?.filter(
            (f: Feature) => f.categoryId === category.id,
          ).length ?? 0;
        const totalFeaturesCount = masterSelectedCount + customFeaturesCount;
        const maxReached = totalFeaturesCount >= 10 || false;
        const isEditingCurrentCategory =
          editingFeature.categoryId === category.id;
        const disableInput =
          isBusy || isLoading || (!isEditingCurrentCategory && maxReached);
        return (
          <Card
            key={category.id}
            className="bg-white dark:bg-black border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg"
          >
            <CardHeader>
              <h3 className="mb-2 font-semibold">
                Custom Features{" "}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({totalFeaturesCount} / 10)
                </span>
              </h3>
              <CardTitle className="text-black dark:text-white">
                {category.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-black dark:text-gray-200">
              {/* Master Features */}
              <div>
                <h3 className="mb-2 font-semibold">Master Features</h3>
                <div className="space-y-2 mt-3">
                  {masterFeatures.map((feature) => (
                    <label
                      key={feature.id}
                      className="flex items-center space-x-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedMasterFeatures[category.id]?.has(
                            feature.id,
                          ) ?? false
                        }
                        onChange={(e) =>
                          handleMasterFeatureCheckboxChange(
                            category.id,
                            feature.id,
                            e.target.checked,
                          )
                        }
                        disabled={
                          isBusy || updateMasterFeaturesMutation.isPending
                        }
                        className="w-5 h-5 accent-indigo-500 dark:accent-indigo-400"
                      />
                      <span>{feature.name}</span>
                      {feature.selected && (
                        <FeatureStar
                          isFeatured={!!feature.isFeatured}
                          disabled={
                            toggleFeaturedMutation.isPending ||
                            (!feature.isFeatured && !canToggleMore)
                          }
                          onToggle={() =>
                            toggleFeaturedMutation.mutate({
                              barId,
                              featureId: feature.id,
                              type: "master-features",
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
                {masterFeatures.length === 0 && (
                  <p className="italic text-gray-500 dark:text-gray-400">
                    No masters features available.
                  </p>
                )}
                {/* The update button is removed! */}
              </div>
              <hr className="mb-3" />
              {/* Custom Features */}
              <div>
                <h3 className="mb-2 font-semibold">Custom Features</h3>
                {customFeatures.length === 0 ? (
                  <p className="italic text-gray-500 dark:text-gray-400">
                    No custom features added.
                  </p>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    {customFeatures.map((feature) => (
                      <li
                        key={feature.id}
                        className="flex justify-between items-center"
                      >
                        <span>{feature.name}</span>
                        <div className="flex gap-1 items-center">
                          <FeatureStar
                            isFeatured={!!feature.isFeatured}
                            disabled={
                              toggleFeaturedMutation.isPending ||
                              (!feature.isFeatured && !canToggleMore)
                            }
                            onToggle={() =>
                              toggleFeaturedMutation.mutate({
                                barId,
                                featureId: feature.id,
                                type: "custom-features",
                              })
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              startEditCustomFeature(category.id, feature)
                            }
                            disabled={isBusy}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            aria-label={`Remove ${feature.name}`}
                            onClick={() =>
                              handleDeleteClick(category.id, feature)
                            }
                            disabled={isBusy}
                          >
                            &times;
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Feature Form */}
              {(isEditingCurrentCategory || formCategoryId === category.id) && (
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex space-x-3">
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder={
                            isEditingCurrentCategory
                              ? "Edit feature name"
                              : maxReached
                                ? "Feature limit reached"
                                : "Add new custom feature"
                          }
                          maxLength={50}
                          disabled={disableInput}
                          aria-disabled={disableInput}
                        />
                      )}
                    />
                    <Button type="submit" disabled={disableInput}>
                      {isEditingCurrentCategory ? "Update" : "Add"}
                    </Button>
                    {isEditingCurrentCategory && (
                      <Button
                        variant="ghost"
                        onClick={cancelEdit}
                        disabled={isBusy}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  {errors.name && (
                    <p className="text-sm text-red-500" role="alert">
                      {errors.name.message}
                    </p>
                  )}
                </form>
              )}
              {!isEditingCurrentCategory && !formCategoryId && !maxReached && (
                <Button
                  onClick={() => setFormCategoryId(category.id)}
                  disabled={isBusy || isLoading}
                >
                  Add Custom Feature
                </Button>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                You can add up to 10 custom features per category.
              </p>
            </CardContent>
          </Card>
        );
      })}
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(v) => setDeleteDialog((d) => ({ ...d, open: v }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feature</DialogTitle>
          </DialogHeader>
          <div>
            Are you sure you want to delete the feature{" "}
            <span className="font-bold">{deleteDialog.featureName}</span>?
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                disabled={deleteCustomFeatureMutation.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteCustomFeatureMutation.isPending}
            >
              {deleteCustomFeatureMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
