import { useEffect, useState } from "react";
import { ReferralQRCodeCard } from "@/components/referral-qr-code-card";
import { ReferralList } from "@/components/referral-list";
import { Loader2 } from "lucide-react";

type ReferralData = {
  earnings: any;
  referrals: {
    username: string;
    referredAt: string;
  }[];
  referralCode: string;
};

export default function Referral() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [referralUrl, setReferralUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        const res = await fetch("/api/kavatender/referrals", {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch referral data");

        const json = await res.json();
        setData(json);

        const baseUrl = import.meta.env.VITE_DOMAIN;
        setReferralUrl(`${baseUrl}/auth?tab=register&ref=${json.referralCode}`);
      } catch (err: any) {
        console.error("Error fetching referral data:", err);
        setError("Unable to load referral data.");
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  return (
    <div className="flex flex-col items-center gap-10 p-8">
      {loading && (
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading your referral stats...</p>
        </div>
      )}

      {error && <p className="text-red-500 text-center font-medium">{error}</p>}

      {data && (
        <>
          <ReferralQRCodeCard
            referralUrl={referralUrl}
            earnings={parseFloat(data.earnings).toFixed(2)}
          />
          <ReferralList referrals={data.referrals} />
        </>
      )}
    </div>
  );
}
