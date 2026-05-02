import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const DEFAULT_REPO = "eliasewu/net2app.com";
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

  const body = await req.json();
  const { action, tag, name, body: releaseBody, draft, prerelease, release_id, repo, path, content, message, sha } = body;

  const REPO = repo || DEFAULT_REPO;

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
      body: JSON.stringify({ tag_name: tag, name: name || tag, body: releaseBody || "", draft: draft || false, prerelease: prerelease || false }),
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
        description: releaseBody || "",
        private: false,
        auto_init: true,
      }),
    });
    const data = await res.json();
    return Response.json({ repo: data, status: res.status });
  }

  // Get file (to retrieve SHA before updating)
  if (action === "get_file") {
    const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${path}`, { headers });
    if (!res.ok) return Response.json({ sha: null, exists: false });
    const data = await res.json();
    return Response.json({ sha: data.sha, exists: true, name: data.name });
  }

  // Push (create or update) a file in the repo
  if (action === "push_file") {
    if (!path || !content) return Response.json({ error: "path and content required" }, { status: 400 });
    // btoa works for ASCII; use TextEncoder for unicode content
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const encoded = btoa(binary);
    const payload = { message: message || "Update file", content: encoded };
    if (sha) payload.sha = sha;
    const res = await fetch(`${API_BASE}/repos/${REPO}/contents/${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return Response.json({ ok: res.ok, status: res.status, data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});