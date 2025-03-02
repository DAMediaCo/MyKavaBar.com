import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  content: z.string().min(1, "Please enter your review"),
});

type ReviewFormProps = {
  barId: number;
  onSuccess?: () => void;
};

type ReviewFormValues = z.infer<typeof reviewSchema>;

export default function ReviewForm({ barId, onSuccess }: ReviewFormProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      content: "",
    },
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold mb-2">Want to share your experience?</h3>
          <p className="text-muted-foreground mb-4">
            Log in or create an account to leave a review.
          </p>
          <Link href="/auth">
            <Button>Log In to Review</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(data: ReviewFormValues) {
    try {
      setIsSubmitting(true);
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          barId,
        }),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit review");
      }

      toast({
        title: "Review Submitted",
        description: "Thank you for your feedback!",
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating</FormLabel>
              <FormControl>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => field.onChange(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      className={cn(
                        "p-1 hover:scale-110 transition-transform",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      )}
                    >
                      <Star
                        className={cn(
                          "w-6 h-6",
                          (hoveredStar !== null
                            ? star <= hoveredStar
                            : star <= field.value)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Review</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Share your experience..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </Button>
      </form>
    </Form>
  );
}