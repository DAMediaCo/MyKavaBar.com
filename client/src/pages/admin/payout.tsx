import { PayoutCardList } from "@/components/admin/payout-card-list";
import { ReferralRewardEditor } from "@/components/admin/referral-reward-editor";

export default function AdminPayoutPage() {
  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <ReferralRewardEditor />
      <PayoutCardList />
    </div>
  );
}
