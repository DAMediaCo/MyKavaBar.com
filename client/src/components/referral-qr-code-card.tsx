import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { CheckIcon, CopyIcon } from "lucide-react";

type Props = {
  referralUrl: string;
  earnings: any;
};

export const ReferralQRCodeCard: React.FC<Props> = ({
  referralUrl,
  earnings,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="w-full max-w-2xl xl:max-w-3xl rounded-2xl shadow-md border border-zinc-200 dark:border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl lg:text-2xl tracking-tight text-zinc-800 dark:text-zinc-100">
          Your Referral Code
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-8 lg:gap-10 px-4 py-6 lg:py-8">
        <div className="p-5 lg:p-6 bg-white rounded-md shadow-sm border">
          <QRCode value={referralUrl} size={180} />
        </div>

        <div className="flex w-full items-center gap-3">
          <Input
            value={referralUrl}
            readOnly
            className="text-sm lg:text-base px-4 py-2"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <CheckIcon size={20} className="text-green-600" />
            ) : (
              <CopyIcon size={20} />
            )}
          </Button>
        </div>

        <div className="text-center mt-1">
          <p className="text-zinc-500 text-sm lg:text-base">
            Total Referral Earnings
          </p>
          <p className="text-3xl font-bold text-green-600 mt-1">${earnings}</p>
        </div>
      </CardContent>
    </Card>
  );
};
