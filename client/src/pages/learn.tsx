import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Leaf, Flower2, Sun, Star } from "lucide-react";
import { Link } from "wouter";

const knowledgeCards = [
  {
    title: "Kava History & Origins",
    description: "Learn about kava's rich history, traditional preparation, cultural significance, varieties, and best practices",
    icon: History,
    path: "/learn/history"
  },
  {
    title: "Kratom Guide",
    description: "Learn about different kratom strains and their traditional uses",
    icon: Leaf,
    path: "/learn/kratom"
  },
  {
    title: "Blue Lotus",
    description: "Discover the ancient Egyptian sacred flower",
    icon: Flower2,
    path: "/learn/blue-lotus"
  },
  {
    title: "Kanna",
    description: "Explore South Africa's traditional mood-enhancing herb",
    icon: Sun,
    path: "/learn/kanna"
  },
  {
    title: "Damiana",
    description: "Understanding the traditional Mexican herb",
    icon: Star,
    path: "/learn/damiana"
  }
];

export default function Learn() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Knowledge Hub</h1>
        <p className="text-muted-foreground mb-6">
          Explore the rich history, culture, and science behind traditional botanicals.
          Learn about preparation methods, different varieties, and best practices for consumption.
        </p>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="grid gap-6">
            {knowledgeCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.path} href={card.path}>
                  <Card className="cursor-pointer hover:bg-accent transition-colors">
                    <CardHeader className="flex flex-row items-center gap-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>{card.description}</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}