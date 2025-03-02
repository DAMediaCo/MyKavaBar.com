import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun } from "lucide-react";

export default function Kanna() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sun className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kanna</h1>
            <p className="text-muted-foreground">Explore South Africa's traditional mood-enhancing herb</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Origins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Kanna (Sceletium tortuosum) is a succulent plant native to South Africa that has
                been used by indigenous peoples for centuries. The San and Khoikhoi peoples
                traditionally used kanna in various social and cultural contexts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traditional Uses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Historically, kanna was chewed, used as a snuff, or brewed into a tea by
                indigenous South African peoples. It played a role in social ceremonies and
                was valued in traditional medicine practices for its unique properties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modern Research</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Contemporary scientific interest in kanna has led to studies examining its
                traditional uses and cultural significance. Research continues to explore
                this unique plant's role in South African traditional medicine and its
                historical importance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
