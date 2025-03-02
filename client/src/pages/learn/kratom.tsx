import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";

export default function KratomGuide() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kratom Guide</h1>
            <p className="text-muted-foreground">Learn about different kratom strains and their traditional uses</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What is Kratom?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kratom (Mitragyna speciosa) is a tropical evergreen tree native to Southeast Asia,
                particularly Thailand, Malaysia, and Indonesia. The leaves have been traditionally
                used in these regions for centuries. Different varieties, known as strains, are
                often categorized by their vein colors and regions of origin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traditional Uses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Historically, kratom leaves were often chewed fresh or dried and brewed into tea
                by workers in Southeast Asian countries. Each strain has unique traditional uses
                and cultural significance in its native regions. The practice continues today in
                many traditional communities.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strain Varieties</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kratom strains are typically classified by the color of the leaf veins and their
                origin. Common varieties include Red Vein, Green Vein, and White Vein, each
                traditionally associated with different properties. Regional varieties such as
                Maeng Da, Bali, and Thai also have distinct characteristics.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
