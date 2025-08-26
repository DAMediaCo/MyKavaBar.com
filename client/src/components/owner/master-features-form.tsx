import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";

type MasterFeature = {
  id: number;
  name: string;
  selected: boolean;
};

export function MasterFeaturesForm({
  barId,
  categoryId,
  masterFeatures,
}: {
  barId: number;
  categoryId: number;
  masterFeatures: MasterFeature[];
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Initialize local state from props
  useEffect(() => {
    setSelectedIds(masterFeatures.filter((f) => f.selected).map((f) => f.id));
  }, [masterFeatures]);

  const saveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await axios.post(
        `/api/bar/${barId}/features/from-master/save`,
        { categoryId, featureIds: ids },
        { withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => {
      // you can invalidate query here if needed
      // queryClient.invalidateQueries(["barFeaturesFull", barId]);
    },
  });

  const toggleSelection = (featureId: number) => {
    setSelectedIds((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId],
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate(selectedIds);
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        {masterFeatures.length === 0 ? (
          <p className="text-gray-500">No master features available.</p>
        ) : (
          masterFeatures.map((feature) => (
            <label
              key={feature.id}
              className="flex items-center space-x-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(feature.id)}
                onChange={() => toggleSelection(feature.id)}
                className="w-5 h-5 accent-indigo-500 dark:accent-indigo-400"
              />
              <span>{feature.name}</span>
            </label>
          ))
        )}
      </div>

      <Button type="submit" disabled={saveMutation.isPending} className="mt-2">
        {saveMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
