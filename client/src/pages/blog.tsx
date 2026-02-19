import { useState, useEffect } from "react";
import { Loader2, ExternalLink } from "lucide-react";

interface BlogArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  image: string;
  date_published: string;
  tags: string[];
}

export default function Blog() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://kavaatlas.com/feed.json")
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.items?.slice(0, 20) || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load blog:", err);
        setError("Failed to load articles");
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
    <div className="min-h-screen bg-[#121212]">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Kava Blog</h1>
            <p className="text-gray-400">
              Latest articles from{" "}
              <a
                href="https://kavaatlas.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D35400] hover:underline"
              >
                KavaAtlas.com
              </a>
            </p>
          </div>

          <div className="grid gap-6">
            {articles.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-[#1E1E1E] rounded-xl border border-[#333] overflow-hidden hover:border-[#D35400] transition-colors"
              >
                <div className="flex flex-col sm:flex-row">
                  {article.image && (
                    <div className="sm:w-48 sm:min-w-[12rem] h-48 sm:h-auto overflow-hidden">
                      <img
                        src={`https://kavaatlas.com${article.image}`}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold text-white group-hover:text-[#D35400] transition-colors line-clamp-2">
                        {article.title}
                      </h2>
                      <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0 mt-1" />
                    </div>
                    <p className="text-gray-400 text-sm mt-2 line-clamp-3">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-gray-500">
                        {new Date(article.date_published).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                      {article.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-[#252525] text-gray-400 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
