import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout } from "lucide-react";

export default function KavaGrowing() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sprout className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Growing & Sustainability</h1>
            <p className="text-muted-foreground">Understanding kava cultivation and sustainability</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cultivation Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kava plants thrive in tropical climates with well-draining, fertile soil and partial
                shade. The plant requires regular rainfall or irrigation and takes 3-5 years to mature.
                Proper spacing and support structures are essential for healthy growth.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sustainable Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Sustainable kava farming involves crop rotation, organic fertilization, and
                responsible harvesting practices. Traditional farming methods often incorporate
                intercropping with other plants, which helps maintain soil health and biodiversity.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Economic Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kava cultivation is an important source of income for many Pacific Island
                communities. Supporting sustainable kava farming practices helps preserve traditional
                agricultural knowledge while ensuring the long-term viability of kava production.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
