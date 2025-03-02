import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2 } from "lucide-react";

export default function KavatendersTable({
  kavaTenders,
  onRemove,
}: {
  kavaTenders: any[];
  onRemove: (userId: number) => void;
}) {
  const [removingId, setRemovingId] = useState<number | null>(null);

  const handleRemove = async (userId: number) => {
    setRemovingId(userId);
    onRemove(userId);
    setRemovingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kavatenders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {kavaTenders.length === 0 ? (
            <h1 className="text-center">No kavatenders</h1>
          ) : (
            <table className="w-full border-collapse border border-gray-700">
              <thead>
                <tr>
                  <th className="border border-gray-700 p-2">Name</th>
                  <th className="border border-gray-700 p-2">Position</th>
                  <th className="border border-gray-700 p-2">Phone Number</th>
                  <th className="border border-gray-700 p-2">Hire Date</th>
                  <th className="border border-gray-700 p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {kavaTenders.map((tender) => (
                  <tr key={tender.userId} className="text-center">
                    <td className="border border-gray-700 p-2">
                      {tender.name}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {tender.position}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {tender.phoneNumber}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {new Date(tender.hireDate).toLocaleDateString()}
                    </td>
                    <td className="border flex items-center justify-center border-gray-700 p-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleRemove(tender.userId)}
                        disabled={removingId === tender.userId}
                        className="flex items-center gap-2"
                      >
                        {removingId === tender.userId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
