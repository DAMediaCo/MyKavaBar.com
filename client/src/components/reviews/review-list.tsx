import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Review = {
  id: number;
  content: string;
  rating: number;
  createdAt: string;
  userId: number; // Added userId to match database schema
  user: {
    username: string;
  };
};

interface ReviewListProps {
  barId: number;
}

export default function ReviewList({ barId }: ReviewListProps) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { toast } = useToast();

  const { data: reviews, isLoading, error } = useQuery<Review[]>({
    queryKey: [`/api/reviews/${barId}`],
    staleTime: 0, // Always refetch to get latest reviews
    queryFn: async () => {
      const response = await fetch(`/api/reviews/${barId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch reviews');
      }

      return response.json();
    }
  });

  const deleteReview = async (reviewId: number) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete review');
      }

      // Update cache query key to match server route
      await queryClient.invalidateQueries({ queryKey: [`/api/reviews/${barId}`] });

      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Error loading reviews: {error.message}
        </CardContent>
      </Card>
    );
  }

  if (!reviews?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No reviews yet. Be the first to review!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <Avatar className="h-10 w-10">
              <span className="font-semibold">
                {review.user.username[0].toUpperCase()}
              </span>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{review.user.username}</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < review.rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="ml-auto text-sm text-muted-foreground">
              {format(new Date(review.createdAt), "MMM d, yyyy")}
              {/* Show delete button for admin or review owner */}
              {(user?.isAdmin || user?.id === review.userId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-red-500"
                  onClick={() => deleteReview(review.id)}
                >
                  Delete
                </Button>
              )}
            </span>
          </CardHeader>
          <CardContent>{review.content}</CardContent>
        </Card>
      ))}
    </div>
  );
}