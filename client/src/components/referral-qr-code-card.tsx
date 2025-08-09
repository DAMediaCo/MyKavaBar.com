import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
          Referral QR Code / Bonus
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr">Referral QR Code</TabsTrigger>
            <TabsTrigger value="bonus">Referral Bonus</TabsTrigger>
          </TabsList>

          {/* First Tab */}
          {/* First Tab */}
          <TabsContent
            value="qr"
            className="flex flex-col items-center gap-4 px-4" // reduced gap + padding
          >
            <div className="p-4 bg-white rounded-md shadow-sm mt-4 border">
              <QRCode value={referralUrl} size={180} />
            </div>
            <div className="flex w-full items-center gap-3">
              <Input
                value={referralUrl}
                readOnly
                className="text-sm lg:text-base px-4 "
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
          </TabsContent>

          {/* Second Tab */}
          <TabsContent
            value="bonus"
            className="flex flex-col items-center justify-center" // reduced top/bottom padding + controlled spacing
          >
            <p className="text-lg text-zinc-500">Your Total Bonus</p>
            <p className="text-4xl font-bold text-green-600">${earnings}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
