import { FaStar, FaRegStar } from "react-icons/fa"; // example star icons from react-icons
import { Button } from "@/components/ui/button";
// Props for FeatureStar component
interface FeatureStarProps {
  isFeatured: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export const FeatureStar: React.FC<FeatureStarProps> = ({
  isFeatured,
  disabled,
  onToggle,
}) => {
  return (
    <Button
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onToggle();
      }}
      aria-label={isFeatured ? "Unmark as favorite" : "Mark as favorite"}
      className={`focus:outline-none ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      {isFeatured ? <FaStar className="text-yellow-400" /> : <FaRegStar />}
    </Button>
  );
};
