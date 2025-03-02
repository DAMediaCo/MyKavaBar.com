import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flower2 } from "lucide-react";

export default function BlueLotus() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Flower2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Blue Lotus</h1>
            <p className="text-muted-foreground">Discover the ancient Egyptian sacred flower</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historical Significance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                The Blue Lotus (Nymphaea caerulea) held great cultural and religious significance
                in ancient Egypt. It was considered sacred and often depicted in hieroglyphics
                and art. The flower was associated with the sun god Ra and the process of
                creation and rebirth.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traditional Preparation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                In ancient Egypt, Blue Lotus was often soaked in wine or prepared as a tea.
                The flowers were also used in religious ceremonies and as decorative elements
                in important cultural events. Various preparation methods have been documented
                in ancient texts and archaeological findings.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern Understanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Today, Blue Lotus is studied for its historical significance and cultural impact
                on ancient civilizations. The flower continues to be appreciated for its
                beautiful appearance and historical importance in Egyptian culture and
                mythology.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
