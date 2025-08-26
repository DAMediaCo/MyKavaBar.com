"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

const featureSchema = z.object({
  name: z.string().min(1, "Feature name is required"),
});

type Feature = {
  id: number;
  categoryId: number;
  name: string;
};

type CategoryWithFeatures = {
  id: number;
  name: string;
  featureCount: number;
  latestFeature: Feature | null;
};

const fetchCategories = async (): Promise<CategoryWithFeatures[]> => {
  const { data } = await axios.get("/api/admin/feature-categories", {
    withCredentials: true,
  });
  return data;
};

const fetchFeaturesByCategory = async (
  categoryId: number,
): Promise<Feature[]> => {
  const { data } = await axios.get(`/api/admin/features/${categoryId}`, {
    withCredentials: true,
  });
  return data;
};

const ManageFeatures: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const [editingCategoryOnly, setEditingCategoryOnly] = useState<number | null>(
    null,
  );
  const [editingFeatureId, setEditingFeatureId] = useState<number | null>(null);

  const { data: features, isLoading: loadingFeatures } = useQuery({
    queryKey: ["features", editingCategoryOnly],
    queryFn: () => fetchFeaturesByCategory(editingCategoryOnly!),
    enabled: editingCategoryOnly != null,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<{ name: string }>({
    resolver: zodResolver(featureSchema),
    defaultValues: { name: "" },
  });

  // Ref for input to scroll on edit
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingFeatureId !== null && features && features.length > 0) {
      const feature = features.find((f) => f.id === editingFeatureId);
      console.log("Editing feature: ", feature);
      if (feature) {
        reset({ name: feature.name });

        // Scroll and focus handled here too if desired
        if (inputRef.current) {
          inputRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          inputRef.current.focus();
        }
      } else {
        // If feature not found, reset form
        reset({ name: "" });
      }
    } else {
      reset({ name: "" });
    }
  }, [editingFeatureId, features, reset]);

  const isLoading = loadingCategories || loadingFeatures || isSubmitting;

  const createFeatureMutation = useMutation({
    mutationFn: (newFeature: { categoryId: number; name: string }) =>
      axios.post("/api/admin/features", newFeature, { withCredentials: true }),
    onSuccess: (res, variables) => {
      queryClient.setQueryData(
        ["categories"],
        (old: CategoryWithFeatures[] | undefined) => {
          if (!old) return old;
          return old.map((cat) => {
            if (cat.id === variables.categoryId) {
              return {
                ...cat,
                featureCount: cat.featureCount + 1,
                latestFeature: res.data,
              };
            }
            return cat;
          });
        },
      );

      queryClient.setQueryData(
        ["features", variables.categoryId],
        (old: Feature[] | undefined) => {
          if (!old) return [res.data];
          return [...old, res.data];
        },
      );

      toast({
        title: "Success",
        description: "Feature added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to add feature.",
        variant: "destructive",
      });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: (updatedFeature: {
      featureId: number;
      name: string;
      categoryId: number;
    }) =>
      axios.put(
        `/api/admin/features/${updatedFeature.featureId}`,
        { name: updatedFeature.name },
        { withCredentials: true },
      ),
    onSuccess: (res, variables) => {
      queryClient.setQueryData(
        ["features", variables.categoryId],
        (old: Feature[] | undefined) => {
          if (!old) return old;
          return old.map((f) => (f.id === variables.featureId ? res.data : f));
        },
      );

      queryClient.setQueryData(
        ["categories"],
        (old: CategoryWithFeatures[] | undefined) => {
          if (!old) return old;
          return old.map((cat) => {
            if (cat.id === variables.categoryId) {
              const featuresForCat =
                queryClient.getQueryData<Feature[]>(["features", cat.id]) || [];
              const latest = featuresForCat.reduce(
                (a, b) => (a.id > b.id ? a : b),
                featuresForCat[0],
              );
              return { ...cat, latestFeature: latest || null };
            }
            return cat;
          });
        },
      );

      toast({
        title: "Updated",
        description: "Feature updated successfully!",
      });
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

  const deleteFeatureMutation = useMutation({
    mutationFn: (feature: { featureId: number; categoryId: number }) =>
      axios.delete(`/api/admin/features/${feature.featureId}`, {
        withCredentials: true,
      }),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(
        ["features", variables.categoryId],
        (old: Feature[] | undefined) => {
          if (!old) return old;
          return old.filter((f) => f.id !== variables.featureId);
        },
      );

      queryClient.setQueryData(
        ["categories"],
        (old: CategoryWithFeatures[] | undefined) => {
          if (!old) return old;
          return old.map((cat) => {
            if (cat.id === variables.categoryId) {
              const featuresForCat =
                queryClient.getQueryData<Feature[]>(["features", cat.id]) || [];
              const latest = featuresForCat.length
                ? featuresForCat.reduce(
                    (a, b) => (a.id > b.id ? a : b),
                    featuresForCat[0],
                  )
                : null;
              return {
                ...cat,
                featureCount: featuresForCat.length,
                latestFeature: latest,
              };
            }
            return cat;
          });
        },
      );

      toast({
        title: "Deleted",
        description: "Feature deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error?.response?.data?.error || "Failed to delete feature.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: { name: string }) => {
    if (!editingCategoryOnly) return;

    if (editingFeatureId) {
      updateFeatureMutation.mutate({
        featureId: editingFeatureId,
        name: data.name.trim(),
        categoryId: editingCategoryOnly,
      });
      setEditingFeatureId(null);
    } else {
      createFeatureMutation.mutate({
        categoryId: editingCategoryOnly,
        name: data.name.trim(),
      });
    }
    reset();
  };

  const deleteFeature = (id: number) => {
    if (!editingCategoryOnly) return;
    if (!window.confirm("Delete this feature?")) return;
    deleteFeatureMutation.mutate({
      featureId: id,
      categoryId: editingCategoryOnly,
    });
  };

  const startEditingFeature = (feature: Feature) => {
    setEditingFeatureId(feature.id);
  };

  if (editingCategoryOnly !== null) {
    const category = categories?.find((cat) => cat.id === editingCategoryOnly);
    if (!category) return null;

    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-4xl font-semibold mb-6">
          Features - {category.name}
        </h1>
        <Button
          className="mb-6"
          onClick={() => {
            setEditingCategoryOnly(null);
            setEditingFeatureId(null);
            reset();
          }}
          disabled={loadingCategories || loadingFeatures || isSubmitting}
        >
          Back to Categories
        </Button>

        <ul className="list-disc ml-5 space-y-3 mb-6">
          {features?.map((feature) => (
            <li key={feature.id} className="flex items-center justify-between">
              <span>{feature.name}</span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditingFeature(feature)}
                  disabled={
                    loadingCategories || loadingFeatures || isSubmitting
                  }
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteFeature(feature.id)}
                  disabled={
                    loadingCategories || loadingFeatures || isSubmitting
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          )) ?? <p>No features found</p>}
        </ul>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-center space-x-3 mb-6"
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                ref={(e) => {
                  field.ref(e);
                  inputRef.current = e;
                }}
                placeholder={
                  editingFeatureId ? "Edit feature name" : "New feature name"
                }
                disabled={loadingCategories || loadingFeatures || isSubmitting}
                autoFocus
                className="flex-grow"
              />
            )}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={loadingCategories || loadingFeatures || isSubmitting}
          >
            {editingFeatureId ? "Save" : "Add"}
          </Button>
          {editingFeatureId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loadingCategories || loadingFeatures || isSubmitting}
              onClick={() => {
                setEditingFeatureId(null);
                reset();
              }}
            >
              Cancel
            </Button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-4xl font-semibold mb-10">Manage Features</h1>
      {loadingCategories && <p>Loading categories...</p>}
      <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {categories?.map((category) => {
          const latestFeature = category.latestFeature;
          return (
            <Card key={category.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow">
                <p className="mb-2 ml-5 text-muted-foreground">
                  {category.featureCount} feature
                  {category.featureCount !== 1 ? "s" : ""}
                </p>
                {latestFeature ? (
                  <ul className="list-disc ml-5 space-y-2 flex-grow">
                    <li>{latestFeature.name}</li>
                  </ul>
                ) : (
                  <p className="ml-5 italic text-muted-foreground">
                    No features yet
                  </p>
                )}
                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingCategoryOnly(category.id);
                      setEditingFeatureId(null);
                      reset();
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ManageFeatures;
