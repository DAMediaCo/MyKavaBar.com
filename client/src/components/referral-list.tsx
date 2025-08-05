import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Referral = {
  username: string;
  referredAt: string;
};

type Props = {
  referrals: Referral[];
};

export const ReferralList: React.FC<Props> = ({ referrals }) => {
  return (
    <Card className="w-full max-w-2xl xl:max-w-3xl rounded-2xl shadow-md border border-zinc-200 dark:border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl lg:text-2xl tracking-tight text-zinc-800 dark:text-zinc-100">
          Your Referrals
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {referrals.length === 0 ? (
          <p className="text-center text-base text-zinc-500 py-10">
            You haven’t referred anyone yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-700">
            {referrals.map((r, i) => (
              <div
                key={i}
                className="flex items-center rounded-sm gap-5 px-4 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-blue-100 text-blue-800 font-semibold text-md">
                    {r.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <span className="font-semibold text-base text-zinc-800 dark:text-zinc-100">
                    {r.username}
                  </span>
                  <span className="text-sm text-zinc-500">
                    Referred on {new Date(r.referredAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
