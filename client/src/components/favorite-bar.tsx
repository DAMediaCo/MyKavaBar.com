import { Button } from "@/components/ui/button";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  useFavoriteStatus,
  useAddFavorite,
  useRemoveFavorite,
} from "@/hooks/use-favorites";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

export const FavoriteBarDesktop = ({ barId }: { barId: number }) => {
  const { user } = useUser();
  if (!user) return null;
  const { toast } = useToast();
  const { data, isLoading } = useFavoriteStatus(barId);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const toggleFavorite = async () => {
    try {
      if (data?.isFavorite) {
        await removeFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Removed",
          description: "This bar has been removed from your favorites.",
        });
      } else {
        await addFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Added",
          description: "This bar has been added to your favorites.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      disabled={isLoading}
      className="hidden md:flex md:items-center md:justify-center"
      size="icon"
      onClick={toggleFavorite}
    >
      {data?.isFavorite ? (
        <FaHeart className="h-4 w-4 text-red-500" />
      ) : (
        <FaRegHeart className="h-4 w-4 text-black dark:text-white" />
      )}
    </Button>
  );
};

export const FavoriteBarMobile = ({ barId }: { barId: number }) => {
  const { user } = useUser();
  if (!user) return null;
  const { toast } = useToast();
  const { data, isLoading } = useFavoriteStatus(barId);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const toggleFavorite = async () => {
    try {
      if (data?.isFavorite) {
        await removeFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Removed",
          description: "This bar has been removed from your favorites.",
        });
      } else {
        await addFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Added",
          description: "This bar has been added to your favorites.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      disabled={isLoading}
      className="flex md:hidden"
      size="icon"
      onClick={toggleFavorite}
    >
      {data?.isFavorite ? (
        <FaHeart className="h-4 w-4 text-red-500" />
      ) : (
        <FaRegHeart className="h-4 w-4 text-black dark:text-white" />
      )}
    </Button>
  );
};

export const FavoriteBar = ({ barId }: { barId: number }) => {
  const { user } = useUser();
  if (!user) return null;
  const { toast } = useToast();
  const { data, isLoading } = useFavoriteStatus(barId);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const toggleFavorite = async () => {
    try {
      console.log(`Toggling to ${data?.isFavorite}`);
      if (data.isFavorite) {
        await removeFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Removed",
          description: "This bar has been removed from your favorites.",
        });
      } else {
        await addFavorite.mutateAsync(barId);
        toast({
          title: "Favorite Added",
          description: "This bar has been added to your favorites.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      disabled={isLoading}
      className="flex"
      size="icon"
      onClick={toggleFavorite}
    >
      {data?.isFavorite ? (
        <FaHeart className="h-4 w-4 text-red-500" />
      ) : (
        <FaRegHeart className="h-4 w-4 text-black dark:text-white" />
      )}
    </Button>
  );
};
