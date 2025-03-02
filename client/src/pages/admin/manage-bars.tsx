import { useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Loader2, Pencil, Trash, Plus, RefreshCw, MapPin } from "lucide-react";
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
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
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
        }
      });
      if (!response.ok) throw new Error("Failed to fetch bars");
      return response.json();
    }
  });

  // State for latitude and longitude inputs
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");


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
        })
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Google Maps data update request processed successfully"
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
        description: error.message || "Failed to update Google Maps data"
      });
    }
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
      location: bar.location as { lat: number; lng: number } || undefined,
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
      const stateA = a.state || (a.address || "").split(",").pop()?.trim() || "";
      const stateB = b.state || (b.address || "").split(",").pop()?.trim() || "";
      return stateA.localeCompare(stateB);
    }

    if (sortBy === "city") {
      const cityA = a.city || (a.address || "").split(",")[0]?.trim() || "";
      const cityB = b.city || (b.address || "").split(",")[0]?.trim() || "";
      return cityA.localeCompare(cityB);
    }

    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Manage Kava Bars</h1>
          <select
            className="ml-2 p-2 border rounded-md"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "state" | "city")}
          >
            <option value="name">Sort by Name</option>
            <option value="state">Sort by State</option>
            <option value="city">Sort by City</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Maps Update Section with Latitude and Longitude inputs */}
          <div className="flex items-center gap-2">
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

      {/* Bar List */}
      <div className="grid gap-4">
        {sortedBars.map((bar: KavaBar) => (
          <Card key={bar.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <h3 className="font-semibold">{bar.name}</h3>
                <p className="text-sm text-muted-foreground">{bar.address}</p>
                {bar.phone && (
                  <p className="text-sm text-muted-foreground">{bar.phone}</p>
                )}
                {bar.location && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lat: {bar.location.lat.toFixed(6)}, Lng: {bar.location.lng.toFixed(6)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(bar)}
                    title="Edit bar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(bar.id)}
                    title="Delete bar"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <Input
                    type="text"
                    placeholder="Lat"
                    className="w-24 h-7 text-xs"
                    id={`lat-${bar.id}`}
                    defaultValue={bar.location?.lat.toString() || ""}
                  />
                  <Input
                    type="text"
                    placeholder="Lng"
                    className="w-24 h-7 text-xs"
                    id={`lng-${bar.id}`}
                    defaultValue={bar.location?.lng.toString() || ""}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    title="Update coordinates"
                    onClick={() => {
                      const latInput = document.getElementById(`lat-${bar.id}`) as HTMLInputElement;
                      const lngInput = document.getElementById(`lng-${bar.id}`) as HTMLInputElement;

                      if (latInput && lngInput) {
                        const lat = parseFloat(latInput.value);
                        const lng = parseFloat(lngInput.value);

                        if (!isNaN(lat) && !isNaN(lng)) {
                          // Set the latitude and longitude fields
                          setLatitude(lat.toString());
                          setLongitude(lng.toString());

                          // Update with the specific bar ID
                          updateGoogleMapsMutation.mutate();
                        } else {
                          toast({
                            variant: "destructive",
                            title: "Invalid coordinates",
                            description: "Please enter valid latitude and longitude values"
                          });
                        }
                      }
                    }}
                  >
                    <MapPin className="h-3 w-3" />
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
