import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Beaker, BookOpen, Leaf, Heart, Sprout } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";

export default function KavaHistory() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kava History & Origins</h1>
            <p className="text-muted-foreground">Everything you need to know about kava</p>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Ancient Origins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  Kava, known scientifically as Piper methysticum, has been cultivated for over 3,000 years
                  in the Pacific Islands. The word "kava" comes from the Polynesian word "awa," meaning
                  "bitter." Historically, it played a crucial role in religious, social, political, and
                  economic aspects of Pacific Island societies.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Beaker className="h-5 w-5" />
                  Traditional Preparation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  Traditionally, kava root is ground into a fine powder and mixed with water. The mixture
                  is then strained through a special cloth to create a smooth, drinkable beverage. This
                  process requires attention to detail and respect for traditional practices.
                </p>
                <p className="leading-7 mt-4">
                  While traditional methods are still widely used, modern preparation techniques have
                  evolved to include instant kava products and specialized tools. However, many enthusiasts
                  prefer traditional preparation methods for their authenticity and ceremonial value.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Cultural Significance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  In Pacific Island cultures, kava ceremonies are a cornerstone of social and political
                  life. These ceremonies serve as a way to welcome guests, mark important occasions, and
                  strengthen community bonds. The ritualistic preparation and sharing of kava embodies
                  respect, unity, and tradition.
                </p>
                <p className="leading-7 mt-4">
                  Beyond formal ceremonies, kava plays a central role in social gatherings. Traditional
                  kava circles provide a space for community members to come together, share stories,
                  and discuss important matters.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5" />
                  Varieties and Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  There are several distinct varieties of kava, each with its own unique properties and
                  effects. Noble kava varieties are the most widely used and respected for their consistent,
                  balanced effects. Different strains can vary in their potency and the specific nature
                  of their effects.
                </p>
                <p className="leading-7 mt-4">
                  The effects of kava are primarily attributed to compounds called kavalactones. Different
                  varieties contain varying proportions of these compounds, leading to different
                  experiences.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Health & Safety
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  When consumed responsibly, kava is generally considered safe. However, it's important
                  to follow some basic guidelines:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>Use only noble kava varieties from reputable sources</li>
                  <li>Avoid combining kava with alcohol or medications</li>
                  <li>Stay hydrated when consuming kava</li>
                  <li>Listen to your body and consume in moderation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="h-5 w-5" />
                  Growing & Sustainability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-7">
                  Kava plants require specific growing conditions: warm temperatures, high humidity, and
                  well-draining soil. The plant takes 3-5 years to mature before harvest. Sustainable
                  farming practices are crucial for preserving kava's cultural heritage and ensuring its
                  availability for future generations.
                </p>
                <p className="leading-7 mt-4">
                  Traditional farming methods often incorporate principles of sustainability, such as
                  crop rotation and organic farming practices. These methods help maintain soil health
                  and protect the environment while producing high-quality kava.
                </p>
              </CardContent>
            </Card>


          </div>
        </ScrollArea>
      </div>
    </div>
  );
}