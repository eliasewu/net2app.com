import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const REPO = "eliasewu/routing-engine";
const API_BASE = "https://api.github.com";

const headers = {
  "Authorization": `Bearer ${GITHUB_TOKEN}`,
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin only" }, { status: 403 });

  const { action, tag, name, body, draft, prerelease, release_id } = await req.json();

  // List releases
  if (action === "list") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases?per_page=30`, { headers });
    const data = await res.json();
    return Response.json({ releases: data });
  }

  // Create release
  if (action === "create") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag_name: tag, name: name || tag, body: body || "", draft: draft || false, prerelease: prerelease || false }),
    });
    const data = await res.json();
    return Response.json({ release: data, status: res.status });
  }

  // Delete release
  if (action === "delete") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/releases/${release_id}`, { method: "DELETE", headers });
    return Response.json({ ok: res.ok, status: res.status });
  }

  // List tags
  if (action === "tags") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/tags?per_page=30`, { headers });
    const data = await res.json();
    return Response.json({ tags: data });
  }

  // Create repository
  if (action === "create_repo") {
    const res = await fetch(`${API_BASE}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: name,
        description: body || "",
        private: false,
        auto_init: true,
      }),
    });
    const data = await res.json();
    return Response.json({ repo: data, status: res.status });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});