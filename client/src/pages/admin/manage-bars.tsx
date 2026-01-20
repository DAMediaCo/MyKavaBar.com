import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { FaRegSave } from "react-icons/fa";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Pencil,
  Trash,
  Plus,
  RefreshCw,
  MapPin,
  DatabaseBackup,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { KavaBar } from "@db/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const barFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional(),
  placeId: z.string().optional(),
  rating: z.string().optional(),
  location: z
    .object({
      lat: z.coerce
        .number()
        .min(-90)
        .max(90, "Latitude must be between -90 and 90"),
      lng: z.coerce
        .number()
        .min(-180)
        .max(180, "Longitude must be between -180 and 180"),
    })
    .optional(),
});

type BarFormValues = z.infer<typeof barFormSchema>;

export default function ManageBars() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBar, setSelectedBar] = useState<KavaBar | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "state" | "city">("name");
  const [barId, setBarId] = useState<number | null>(null);
  const form = useForm<BarFormValues>({
    resolver: zodResolver(barFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
    },
  });

  const { data: bars = [], isLoading } = useQuery({
    queryKey: ["admin-bars", sortBy],
    queryFn: async () => {
      const response = await fetch("/api/kava-bars", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch bars");
      return response.json();
    },
  });

  // State for latitude and longitude inputs
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [search, setSearch] = useState("");

  // Mutation for updating Google Maps data
  const updateGoogleMapsMutation = useMutation({
    mutationFn: async () => {
      // Parse to numbers or use null if invalid
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      const response = await fetch("/api/admin/update-google-maps-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Google Maps data update request processed successfully",
      });
      console.log("Google Maps update response:", data);

      // Reset input fields after successful update
      setLatitude("");
      setLongitude("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update Google Maps data",
      });
    },
  });

  const updateCoordsMutation = useMutation({
    mutationFn: async () => {
      if (!barId) return;
      if (barId && isNaN(barId)) return;
      // Parse to numbers or use null if invalid
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;
      const response = await fetch(`/api/admin/update-coords/${barId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Bar coordinates updated successfully",
      });
      // Reset input fields after successful update
      setLatitude("");
      setLongitude("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update coordinates",
      });
    },
  });

  const addBarMutation = useMutation({
    mutationFn: async (values: BarFormValues) => {
      const response = await fetch("/api/admin/bars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bars", sortBy] });
      toast({ title: "Success", description: "Bar added successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const editBarMutation = useMutation({
    mutationFn: async (values: BarFormValues & { id: number }) => {
      const response = await fetch(`/api/admin/bars/${values.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bars", sortBy] });
      toast({ title: "Success", description: "Bar updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedBar(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteBarMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/bars/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bars", sortBy] });
      toast({ title: "Success", description: "Bar deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: BarFormValues) => {
    if (selectedBar) {
      editBarMutation.mutate({ ...values, id: selectedBar.id });
    } else {
      addBarMutation.mutate(values);
    }
  };

  const handleEdit = (bar: KavaBar) => {
    setSelectedBar(bar);
    form.reset({
      name: bar.name,
      address: bar.address,
      phone: bar.phone || "",
      placeId: bar.placeId || "",
      rating: bar.rating?.toString() || "",
      location: (bar.location as { lat: number; lng: number }) || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this bar?")) {
      deleteBarMutation.mutate(id);
    }
  };

  if (!user?.isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Safe sorting function with proper fallbacks for missing properties
  const sortedBars = [...bars].sort((a, b) => {
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");

    if (sortBy === "state") {
      const stateA =
        a.state || (a.address || "").split(",").pop()?.trim() || "";
      const stateB =
        b.state || (b.address || "").split(",").pop()?.trim() || "";
      return stateA.localeCompare(stateB);
    }

    if (sortBy === "city") {
      const cityA = a.city || (a.address || "").split(",")[0]?.trim() || "";
      const cityB = b.city || (b.address || "").split(",")[0]?.trim() || "";
      return cityA.localeCompare(cityB);
    }

    return 0;
  });
  // Filter bars based on search and location
  const filteredBars = sortedBars?.filter((bar) => {
    const matchesSearch =
      !search || // Show all bars when search is empty
      bar.name.toLowerCase().includes(search.toLowerCase()) ||
      bar.address.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between flex-col md:flex-row  items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Manage Kava Bars</h1>
          <select
            className="ml-2 p-2 border rounded-md"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "name" | "state" | "city")
            }
          >
            <option value="name">Sort by Name</option>
            <option value="state">Sort by State</option>
            <option value="city">Sort by City</option>
          </select>
        </div>

        <div className="flex items-center flex-col md:flex-row gap-2">
          {/* Google Maps Update Section with Latitude and Longitude inputs */}
          <div className="flex items-center flex-col md:flex-row gap-2">
            <Input
              type="text"
              placeholder="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-32"
            />
            <Input
              type="text"
              placeholder="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-32"
            />

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => updateGoogleMapsMutation.mutate()}
              disabled={updateGoogleMapsMutation.isPending}
            >
              {updateGoogleMapsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Update from Google Maps
            </Button>
            
            </div>

          {/* Add New Bar Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add New Bar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Kava Bar</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rating</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.1"
                            min="0"
                            max="5"
                            placeholder="e.g. 4.5"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="location.lat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g. 27.4177272"
                              type="number"
                              step="0.000001"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location.lng"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g. -82.5511247"
                              type="number"
                              step="0.000001"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    {addBarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add Bar"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Bar Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Kava Bar</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                {editBarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update Bar"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <div className="relative flex-1 mb-3">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search Kava Bars by Name, State, or City."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {/* Data Management Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Restore missing data from backups or update information from
            external sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                Florida Kava Bars Restoration
              </h3>
              <p className="text-sm text-muted-foreground">
                Analyze and restore missing Florida kava bars from the backup
                created on January 27, 2025.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="gap-2 w-full"
                  onClick={() => {
                    // Implement the analysis function here
                    toast({
                      title: "Analysis Started",
                      description:
                        "Analyzing missing Florida bars from backup...",
                    });

                    fetch("/api/admin/restore-florida-bars", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                    })
                      .then((response) => {
                        if (!response.ok)
                          throw new Error("Failed to analyze Florida bars");
                        return response.json();
                      })
                      .then((data) => {
                        if (data.success) {
                          const analyzedCount = data.result?.analyzed || 0;
                          toast({
                            title: "Analysis Complete",
                            description: `Found ${analyzedCount} missing Florida bars.`,
                            variant: "default",
                          });
                          // Log to console for debugging
                          console.log("Analysis complete:", data.result);
                        } else {
                          throw new Error(
                            data.error || "Unknown error occurred",
                          );
                        }
                      })
                      .catch((error) => {
                        toast({
                          title: "Analysis Failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      });
                  }}
                >
                  <DatabaseBackup className="h-4 w-4" />
                  Analyze Missing Bars
                </Button>

                <Button
                  variant="default"
                  className="gap-2 w-full"
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Are you sure you want to restore missing Florida bars? This operation cannot be undone.",
                      )
                    ) {
                      return;
                    }

                    toast({
                      title: "Restoration Started",
                      description:
                        "Starting to restore missing Florida bars...",
                    });

                    // First analyze to get the list of missing bars
                    fetch("/api/admin/restore-florida-bars", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                    })
                      .then((response) => {
                        if (!response.ok)
                          throw new Error("Failed to analyze Florida bars");
                        return response.json();
                      })
                      .then((data) => {
                        if (!data.success || !data.result) {
                          throw new Error("Analysis failed");
                        }

                        // If analysis found missing bars, send them for restoration
                        const missingBars = data.result.missingBars;
                        if (!missingBars || missingBars.length === 0) {
                          toast({
                            title: "No Action Needed",
                            description:
                              "No missing Florida bars found. Nothing to restore.",
                            variant: "default",
                          });
                          return;
                        }

                        // Confirm restoration with the analyzed bars
                        return fetch(
                          "/api/admin/confirm-restore-florida-bars",
                          {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ missingBars }),
                          },
                        );
                      })
                      .then((response) => {
                        if (!response) return; // No restoration was needed
                        if (!response.ok)
                          throw new Error("Failed to restore Florida bars");
                        return response.json();
                      })
                      .then((data) => {
                        if (!data) return; // No restoration was performed

                        if (data.success) {
                          toast({
                            title: "Restoration Complete",
                            description:
                              data.message ||
                              `Restored ${data.result?.restored || 0} Florida bars.`,
                            variant: "default",
                          });

                          // Refresh the bar list
                          queryClient.invalidateQueries({
                            queryKey: ["admin-bars", sortBy],
                          });
                        } else {
                          throw new Error(
                            data.error ||
                              "Unknown error occurred during restoration",
                          );
                        }
                      })
                      .catch((error) => {
                        toast({
                          title: "Restoration Failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      });
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Restore Missing Bars
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Data Metrics</h3>
              <p className="text-sm text-muted-foreground">
                Current database statistics and data completeness.
              </p>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span>Total Kava Bars:</span>
                  <span className="font-medium">{sortedBars.length}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Florida Bars:</span>
                  <span className="font-medium">
                    {
                      sortedBars.filter(
                        (bar) =>
                          bar.address &&
                          (bar.address.includes(", FL") ||
                            bar.address.includes(", Florida")),
                      ).length
                    }
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Verified Bars:</span>
                  <span className="font-medium">
                    {
                      sortedBars.filter(
                        (bar) => bar.verificationStatus === "verified",
                      ).length
                    }
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Missing Location Data:</span>
                  <span className="font-medium">
                    {sortedBars.filter((bar) => !bar.location).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar List */}
      <div className="grid gap-4">
        {filteredBars.map((bar: KavaBar) => (
          <Card key={bar.id}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 gap-4 sm:gap-0">
              <div className="flex-1">
                <h3 className="font-semibold">{bar.name}</h3>
                <p className="text-sm text-muted-foreground">{bar.address}</p>
                {bar.phone && (
                  <p className="text-sm text-muted-foreground">{bar.phone}</p>
                )}
                {bar.location && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lat: {bar.location.lat.toFixed(6)}, Lng:{" "}
                    {bar.location.lng.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                <div className="flex gap-2 justify-start sm:justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(bar)}
                    title="Edit bar"
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(bar.id)}
                    title="Delete bar"
                    className="h-8 w-8"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Lat"
                    className="w-24 h-8 text-xs"
                    id={`lat-${bar.id}`}
                    defaultValue={bar.location?.lat.toString() || ""}
                  />
                  <Input
                    type="text"
                    placeholder="Lng"
                    className="w-24 h-8 text-xs"
                    id={`lng-${bar.id}`}
                    defaultValue={bar.location?.lng.toString() || ""}
                  />

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const latInput = document.getElementById(
                        `lat-${bar.id}`,
                      ) as HTMLInputElement;
                      const lngInput = document.getElementById(
                        `lng-${bar.id}`,
                      ) as HTMLInputElement;

                      if (latInput && lngInput) {
                        const lat = parseFloat(latInput.value);
                        const lng = parseFloat(lngInput.value);

                        if (!isNaN(lat) && !isNaN(lng)) {
                          setLatitude(lat.toString());
                          setLongitude(lng.toString());
                          setBarId(bar.id);
                          updateCoordsMutation.mutate();
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Invalid coordinates",
                            description:
                              "Please enter valid latitude and longitude values",
                          });
                        }
                      }
                    }}
                  >
                    <FaRegSave className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Update coordinates"
                    onClick={() => {
                      const latInput = document.getElementById(
                        `lat-${bar.id}`,
                      ) as HTMLInputElement;
                      const lngInput = document.getElementById(
                        `lng-${bar.id}`,
                      ) as HTMLInputElement;

                      if (latInput && lngInput) {
                        const lat = parseFloat(latInput.value);
                        const lng = parseFloat(lngInput.value);

                        if (!isNaN(lat) && !isNaN(lng)) {
                          setLatitude(lat.toString());
                          setLongitude(lng.toString());

                          updateGoogleMapsMutation.mutate();
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Invalid coordinates",
                            description:
                              "Please enter valid latitude and longitude values",
                          });
                        }
                      }
                    }}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
