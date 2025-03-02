import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";

export default function KavaVarieties() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kava Varieties</h1>
            <p className="text-muted-foreground">Explore different strains and their unique properties</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Noble vs. Tudei</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kava varieties are broadly categorized into Noble and Tudei types. Noble kava varieties
                are preferred for their balanced effects and traditional use. Tudei varieties, while
                more potent, are generally avoided in traditional practice due to their longer-lasting
                effects.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Popular Varieties</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Some well-known noble kava varieties include Borogu from Vanuatu, known for its
                balanced effects; Melo Melo from Fiji, appreciated for its mild nature; and Mahakea
                from Hawaii, valued for its traditional ceremonial use. Each variety offers unique
                characteristics in terms of taste, strength, and effects.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Differences</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Different Pacific Island nations have cultivated their own distinct kava varieties,
                adapted to local growing conditions and cultural preferences. These regional
                differences contribute to the rich diversity of kava varieties available today.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
