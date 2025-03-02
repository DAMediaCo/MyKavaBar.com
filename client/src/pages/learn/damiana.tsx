import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function Damiana() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Star className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Damiana</h1>
            <p className="text-muted-foreground">Understanding the traditional Mexican herb</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About Damiana</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Damiana (Turnera diffusa) is a small shrub native to Mexico, Central America,
                and the West Indies. It has been used in traditional Mexican medicine and by
                indigenous peoples of Central and South America for centuries.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historical Use</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Traditionally, damiana leaves were brewed into a tea or used in traditional
                ceremonies by various indigenous peoples. The Mayan civilization was known
                to use damiana in their traditional practices and cultural ceremonies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cultural Significance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                In Mexican folk medicine and culture, damiana holds a special place as a
                traditional herb. It continues to be appreciated for its historical
                significance and role in traditional practices throughout Central America.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
