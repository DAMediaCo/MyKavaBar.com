import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function KavaCulture() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Cultural Significance</h1>
            <p className="text-muted-foreground">Understand kava's role in ceremonies and gatherings</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ceremonial Use</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                In Pacific Island cultures, kava ceremonies are a cornerstone of social and political
                life. These ceremonies serve as a way to welcome guests, mark important occasions, and
                strengthen community bonds. The ritualistic preparation and sharing of kava embodies
                respect, unity, and tradition.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Gatherings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Beyond formal ceremonies, kava plays a central role in social gatherings. Traditional
                kava circles provide a space for community members to come together, share stories,
                and discuss important matters. These gatherings foster open dialogue and strengthen
                social bonds.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Today, kava's cultural significance extends beyond traditional Pacific Island
                communities. Modern kava bars create inclusive spaces that honor traditional practices
                while adapting to contemporary social contexts, bridging cultural gaps and promoting
                cross-cultural understanding.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
