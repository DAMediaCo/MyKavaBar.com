"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RiPlugLine,
  RiSofaLine,
  RiGamepadLine,
  RiCalendarLine,
  RiShoppingBag3Line,
} from "react-icons/ri";
import { LuCupSoda } from "react-icons/lu";

type MasterFeature = {
  id: number;
  categoryId: number;
  name: string;
  isFeatured: boolean;
};

type CustomFeature = {
  id: number;
  name: string;
  categoryId: number;
  isFeatured: boolean;
};

type Category = {
  id: number;
  name: string;
};

type ApiResponse = {
  masterFeatures: MasterFeature[];
  customFeatures: CustomFeature[];
};

// Use the same categories and icons as before
const categories: Category[] = [
  { id: 1, name: "Tech & Connectivity" },
  { id: 2, name: "Entertainment" },
  { id: 3, name: "Seating & Environment" },
  { id: 4, name: "Events & Community" },
  { id: 5, name: "Food & Drink" },
  { id: 6, name: "Merch & Loyalty" },
];

const categoryIcons: Record<number, JSX.Element> = {
  1: <RiPlugLine className="inline mr-1" />,
  2: <RiGamepadLine className="inline mr-1" />,
  3: <RiSofaLine className="inline mr-1" />,
  4: <RiCalendarLine className="inline mr-1" />,
  5: <LuCupSoda className="inline mr-1" />,
  6: <RiShoppingBag3Line className="inline mr-1" />,
};

export const BarFeatures = ({ barId }: { barId: number }) => {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  // Fetch features from API
  useEffect(() => {
    async function fetchFeatures() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bar/${barId}/features`);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatures();
  }, [barId]);

  if (loading) return <div>Loading features...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!data) return null;

  // Combine all features into single array with source flags for display
  type FeatureWithType = {
    id: number;
    categoryId: number;
    name: string;
    isFeatured: boolean;
    type: "master" | "custom";
    selected?: boolean; // only for master
  };

  const combinedFeatures: any[] = [
    ...data.masterFeatures.map((f) => ({
      id: f.id,
      categoryId: f.categoryId,
      name: f.name,
      isFeatured: f.isFeatured,
      type: "master",
    })),
    ...data.customFeatures.map((f) => ({
      id: f.id,
      categoryId: f.categoryId,
      name: f.name,
      isFeatured: f.isFeatured,
      type: "custom",
    })),
  ];

  // Filter favorited features for top view
  const favoritedFeatures = combinedFeatures.filter((f) => f.isFeatured);

  // Group features by category for expanded view
  const groupedByCategory: Record<number, FeatureWithType[]> = {};
  combinedFeatures.forEach((f) => {
    if (!groupedByCategory[f.categoryId]) groupedByCategory[f.categoryId] = [];
    groupedByCategory[f.categoryId].push(f);
  });

  const favoritedLimit = 5;

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Bar Features</CardTitle>
        </CardHeader>
        <CardContent>
          {!expanded ? (
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              {favoritedFeatures.slice(0, favoritedLimit).map((f) => {
                const icon = categoryIcons[f.categoryId];
                return (
                  <Badge
                    key={`${f.type}-${f.id}`}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {icon}
                    {f.name}
                  </Badge>
                );
              })}
              <Button
                onClick={() => setExpanded(true)}
                variant="outline"
                size="sm"
              >
                View More
              </Button>
            </div>
          ) : (
            <>
              {categories.map((cat) => {
                const featuresInCat = groupedByCategory[cat.id];
                if (!featuresInCat || featuresInCat.length === 0) return null;
                return (
                  <section key={cat.id} className="mb-6">
                    <h3 className="flex items-center mb-2 text-lg font-semibold">
                      {categoryIcons[cat.id]}
                      {cat.name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {featuresInCat.map((f) => (
                        <Badge
                          key={`${f.type}-${f.id}`}
                          variant="secondary"
                          className="cursor-default"
                        >
                          {f.name}
                        </Badge>
                      ))}
                    </div>
                  </section>
                );
              })}
              <Button
                onClick={() => setExpanded(false)}
                variant="outline"
                size="sm"
              >
                Show Less
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
