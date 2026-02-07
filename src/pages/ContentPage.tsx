import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, Plus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type BookmarkRow = Tables<"bookmarks">;

export default function ContentPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBookmarks(data);
  };

  const addBookmark = async () => {
    if (!url.trim()) return;
    setIsAdding(true);
    try {
      // Save bookmark, AI will summarize later via agent
      const { error } = await supabase.from("bookmarks").insert({
        url: url.trim(),
        title: new URL(url.trim()).hostname,
      });
      if (error) throw error;
      toast.success("Bookmark added to your content queue");
      setUrl("");
      fetchBookmarks();
    } catch {
      toast.error("Failed to add bookmark");
    } finally {
      setIsAdding(false);
    }
  };

  const categoryColor: Record<string, string> = {
    read_later: "bg-primary/10 text-primary",
    research: "bg-accent text-accent-foreground",
    implement: "bg-success/10 text-success",
    watch: "bg-warning/10 text-warning",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Content Queue</h1>
          <p className="text-sm text-muted-foreground">
            Save and organize content for later
          </p>
        </div>

        {/* Add URL */}
        <div className="mb-6 flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a URL to save..."
            className="rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && addBookmark()}
          />
          <Button onClick={addBookmark} disabled={isAdding} className="shrink-0 rounded-xl">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-medium">No saved content</h2>
            <p className="text-sm text-muted-foreground">
              Paste a URL above to add to your queue
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bm) => (
              <Card key={bm.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium">
                      {bm.title || bm.url}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {bm.category && (
                        <Badge variant="outline" className={categoryColor[bm.category] || ""}>
                          {bm.category?.replace("_", " ")}
                        </Badge>
                      )}
                      <a
                        href={bm.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </CardHeader>
                {bm.content_summary && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {bm.content_summary}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
