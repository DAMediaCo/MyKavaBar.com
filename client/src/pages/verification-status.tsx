import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { formatDistance } from "date-fns";

interface VerificationStats {
  total: number;
  verified: number;
  pending: number;
  notKavaBars: number;
  averageCompleteness: number;
}

interface Bar {
  id: number;
  name: string;
  address: string;
  verificationStatus: string;
  lastVerified: string;
  dataCompletenessScore: number;
  isVerifiedKavaBar: boolean;
  verificationNotes: string;
  businessStatus: string;
}

interface VerificationResponse {
  statistics: VerificationStats;
  bars: Bar[];
}

export default function VerificationStatus() {
  const { data, isLoading, error } = useQuery<VerificationResponse>({
    queryKey: ["/api/kava-bars/verification-status"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error loading verification status: {error.message}
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.statistics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Kava Bars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.statistics.verified}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Kava Bars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.statistics.notKavaBars}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Completeness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.statistics.averageCompleteness * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Last Verified</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bars.map((bar) => (
                  <TableRow key={bar.id}>
                    <TableCell className="font-medium">{bar.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          bar.isVerifiedKavaBar
                            ? "bg-green-100 text-green-700"
                            : bar.verificationStatus === "not_kava_bar"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {bar.verificationStatus || "Pending"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(bar.dataCompletenessScore * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {bar.lastVerified
                        ? formatDistance(new Date(bar.lastVerified), new Date(), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {bar.verificationNotes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
