import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { z } from "zod";

const reviewSchema = z.object({
  content: z.string().min(1, "Review content is required"),
  rating: z.number().min(1).max(5),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  barId: number;
}

export default function ReviewForm({ barId }: ReviewFormProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      content: "",
      rating: 0,
    },
  });

  const { mutateAsync: submitReview } = useMutation<any, Error, ReviewFormData>({
    mutationFn: async (data) => {
      const response = await fetch(`/api/kava-bars/${barId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${barId}`] });
      form.reset();
    },
  });

  async function onSubmit(data: ReviewFormData) {
    try {
      await submitReview(data);
      toast({
        title: "Success",
        description: "Your review has been submitted!",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onMouseEnter={() => setHoveredRating(rating)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => form.setValue("rating", rating)}
                >
                  <Star
                    className={`h-4 w-4 ${
                      (hoveredRating || form.getValues("rating")) >= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </Button>
              ))}
            </div>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Write your review here..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Submit Review
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
