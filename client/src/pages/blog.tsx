import { useState, useEffect } from "react";
import { Loader2, ExternalLink, ArrowUpRight } from "lucide-react";

interface BlogArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  image: string;
  date_published: string;
  tags: string[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1530530488745-5e79f4ea7b48?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&auto=format&fit=crop",
];

function imgSrc(image: string, index: number = 0) {
  if (image && image.trim()) {
    if (image.startsWith("http")) return image;
    return `https://kavaatlas.com${image}`;
  }
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

/** Hero card — full width, big image */
function HeroCard({ article, index }: { article: BlogArticle; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group col-span-2 lg:col-span-3 relative h-[340px] sm:h-[420px] rounded-2xl overflow-hidden block border border-[#333] hover:border-[#D35400] transition-all duration-300"
    >
      <img
        src={imgSrc(article.image, index)}
        alt={article.title}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex gap-2 mb-3 flex-wrap">
          {article.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="bg-[#D35400]/90 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
              {tag}
            </span>
          ))}
        </div>
        <h2 className="text-white font-bold text-2xl sm:text-3xl leading-tight mb-2 group-hover:text-[#E67E22] transition-colors line-clamp-2">
          {article.title}
        </h2>
        <p className="text-gray-300 text-sm line-clamp-2 mb-3 max-w-2xl">{article.summary}</p>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">{formatDate(article.date_published)}</span>
          <span className="flex items-center gap-1 text-[#D35400] text-sm font-semibold group-hover:gap-2 transition-all">
            Read Article <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </a>
  );
}

/** Standard card — portrait with image top */
function StandardCard({ article, index }: { article: BlogArticle; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group col-span-2 sm:col-span-1 flex flex-col bg-[#1E1E1E] rounded-2xl overflow-hidden border border-[#333] hover:border-[#D35400] transition-all duration-300 hover:-translate-y-1"
    >
      <div className="h-44 overflow-hidden relative flex-shrink-0">
        <img
          src={imgSrc(article.image, index)}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {article.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="bg-[#2A2A2A] text-gray-400 text-[0.65rem] px-2 py-0.5 rounded-full uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
        <h2 className="text-white font-bold text-base leading-snug mb-2 group-hover:text-[#D35400] transition-colors line-clamp-3 flex-1">
          {article.title}
        </h2>
        <p className="text-gray-500 text-xs line-clamp-2 mb-3">{article.summary}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-gray-600 text-xs">{formatDate(article.date_published)}</span>
          <ExternalLink className="h-3.5 w-3.5 text-gray-600 group-hover:text-[#D35400] transition-colors" />
        </div>
      </div>
    </a>
  );
}

/** Wide card — landscape with image left, text right */
function WideCard({ article, index }: { article: BlogArticle; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group col-span-2 flex bg-[#1E1E1E] rounded-2xl overflow-hidden border border-[#333] hover:border-[#D35400] transition-all duration-300 hover:-translate-y-1"
    >
      <div className="w-48 sm:w-56 flex-shrink-0 overflow-hidden relative">
        <img
          src={imgSrc(article.image, index)}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]; }}
        />
      </div>
      <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {article.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="bg-[#2A2A2A] text-gray-400 text-[0.65rem] px-2 py-0.5 rounded-full uppercase tracking-wider">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="text-white font-bold text-lg leading-snug mb-2 group-hover:text-[#D35400] transition-colors line-clamp-2">
            {article.title}
          </h2>
          <p className="text-gray-400 text-sm line-clamp-3">{article.summary}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-gray-500 text-xs">{formatDate(article.date_published)}</span>
          <span className="flex items-center gap-1 text-[#D35400] text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Read <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

// Bento pattern: hero (full), 2 standard, wide+standard, 2 standard, wide... repeat
function getCardType(index: number): "hero" | "standard" | "wide" {
  if (index === 0) return "hero";
  const pos = index - 1; // 0-based after hero
  const cycle = pos % 7;
  // Cycle: std std wide std std wide std → then repeats
  if (cycle === 2 || cycle === 5) return "wide";
  return "standard";
}

export default function Blog() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://kavaatlas.com/feed.json")
      .then(r => r.json())
      .then(data => { setArticles(data.items?.slice(0, 20) || []); setIsLoading(false); })
      .catch(() => { setError("Failed to load articles"); setIsLoading(false); });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D35400]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1C]">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#D35400] text-xs font-bold uppercase tracking-widest mb-1">The Kava Blog</p>
          <h1 className="text-3xl font-bold text-white mb-1">Latest Articles</h1>
          <p className="text-gray-500 text-sm">
            Powered by{" "}
            <a href="https://kavaatlas.com" target="_blank" rel="noopener noreferrer" className="text-[#D35400] hover:underline">
              KavaAtlas.com
            </a>
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">
          {articles.map((article, i) => {
            const type = getCardType(i);
            if (type === "hero") return <HeroCard key={article.id} article={article} index={i} />;
            if (type === "wide") return <WideCard key={article.id} article={article} index={i} />;
            return <StandardCard key={article.id} article={article} index={i} />;
          })}
        </div>
      </div>
    </div>
  );
}
