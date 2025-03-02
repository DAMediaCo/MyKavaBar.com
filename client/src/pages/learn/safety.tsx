import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function KavaSafety() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Health & Safety</h1>
            <p className="text-muted-foreground">Guidelines for safe and responsible consumption</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Safe kava consumption begins with using only noble kava varieties from reputable
                sources. It's recommended to start with small amounts and gradually find your
                comfortable level. Staying hydrated and not mixing kava with alcohol or other
                substances are essential safety practices.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Important Considerations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                While kava has a long history of safe traditional use, it's important to be aware of
                potential interactions with medications. Consult healthcare providers if you have
                underlying health conditions or take prescription medications. Pregnant or nursing
                individuals should avoid kava consumption.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Assurance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7">
                Choose kava products that undergo quality testing and comply with local regulations.
                Look for vendors who provide detailed information about their sourcing and testing
                practices. Quality kava should come from reputable suppliers who prioritize safety
                and transparency.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
