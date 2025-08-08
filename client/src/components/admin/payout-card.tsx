import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

type Props = {
  id: number;
  firstName: string;
  lastName: string;
  totalEarned: number;
  alreadyPaid: number;
  phoneNumber: string;
  onPayout: (id: number) => void;
  disabled?: boolean; // ← add this
};

export const PayoutCard: React.FC<Props> = ({
  id,
  firstName,
  lastName,
  phoneNumber,
  totalEarned,
  alreadyPaid,
  onPayout,
  disabled,
}) => {
  const pending = totalEarned - alreadyPaid;
  const isEligible = pending >= 50;

  return (
    <div className="flex items-center justify-between border p-6 rounded-xl shadow-md bg-muted/30">
      <div className="flex flex-col gap-1">
        <span className="text-lg font-semibold">
          {firstName || lastName ? `${firstName ?? ""} ${lastName ?? ""}` : ""}
        </span>
        {phoneNumber && (
          <a
            href={`tel:${phoneNumber}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            📞 {phoneNumber}
          </a>
        )}

        <div className="text-base text-muted-foreground flex flex-wrap gap-6">
          <span>Total Earned: ${totalEarned.toFixed(2)}</span>
          <span>Paid: ${alreadyPaid.toFixed(2)}</span>
          <span className={pending > 0 ? "text-orange-600 font-semibold" : ""}>
            Pending: ${pending.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isEligible ? (
          <Button
            onClick={() => onPayout(id)}
            size="default"
            className="px-5 py-2"
            disabled={disabled} // ← this line is critical
          >
            {disabled ? "Processing..." : "Mark $50 Paid"}
          </Button>
        ) : (
          <Badge variant="secondary" className="text-sm px-3 py-1.5">
            Not eligible
          </Badge>
        )}
        {pending === 0 && <CheckCircle2 className="text-green-600" size={24} />}
      </div>
    </div>
  );
};
