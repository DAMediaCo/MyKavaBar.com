import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beaker } from "lucide-react";

export default function KavaPreparation() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Beaker className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Traditional Preparation</h1>
            <p className="text-muted-foreground">Learn authentic methods of preparing kava</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Traditional Method</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Traditionally, kava root is ground into a fine powder and mixed with water. The mixture
                is then strained through a special cloth to create a smooth, drinkable beverage. This
                process requires attention to detail and respect for traditional practices.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern Preparation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                While traditional methods are still widely used, modern preparation techniques have
                evolved to include instant kava products and specialized tools. However, many enthusiasts
                prefer traditional preparation methods for their authenticity and ceremonial value.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Considerations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                The quality of kava preparation depends on several factors, including water temperature,
                kneading technique, and the quality of the kava root itself. Using the right tools and
                following proper techniques ensures the best possible experience.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
