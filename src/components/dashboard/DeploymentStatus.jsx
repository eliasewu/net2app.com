import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, ExternalLink, CheckCircle2, Clock, Tag } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const invoke = (action, payload = {}) =>
  base44.functions.invoke("githubRelease", { action, ...payload });

export default function DeploymentStatus() {
  const { data: releasesData, isLoading } = useQuery({
    queryKey: ["github-releases-dash"],
    queryFn: () => invoke("list"),
    refetchInterval: 120000,
  });

  const releases = releasesData?.data?.releases || [];
  const latest = releases[0];
  const recent = releases.slice(0, 4);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />Deployment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />Deployment Status
          </CardTitle>
          <a href="https://github.com/eliasewu/net2app.com" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <ExternalLink className="w-3 h-3" />GitHub
            </Button>
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Latest release highlight */}
        {latest ? (
          <div className="p-3 rounded-lg border bg-green-50 border-green-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-sm text-green-800">Latest: {latest.tag_name}</span>
                {latest.draft && <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-300">Draft</Badge>}
                {latest.prerelease && <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">Pre-release</Badge>}
                {!latest.draft && !latest.prerelease && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Released</Badge>}
              </div>
              <span className="text-xs text-green-700 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {latest.published_at ? formatDistanceToNow(new Date(latest.published_at), { addSuffix: true }) : "—"}
              </span>
            </div>
            {latest.body && (
              <p className="text-xs text-green-700 mt-1 line-clamp-2">{latest.body}</p>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-lg border bg-muted text-muted-foreground text-xs text-center">No releases yet</div>
        )}

        {/* Recent builds */}
        {recent.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Releases</p>
            {recent.slice(1).map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-xs font-bold text-blue-700">{r.tag_name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{r.name || r.tag_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.published_at ? format(new Date(r.published_at), "dd MMM yyyy") : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Deploy command */}
        <div className="bg-gray-900 text-green-400 rounded-md px-3 py-2 text-xs font-mono break-all">
          bash &lt;(curl -s https://raw.githubusercontent.com/eliasewu/net2app.com/main/deploy.sh)
        </div>
      </CardContent>
    </Card>
  );
}