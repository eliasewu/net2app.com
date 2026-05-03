import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { upload_url, filename, script_content } = await req.json();

  if (!upload_url || !filename || !script_content) {
    return Response.json({ error: "upload_url, filename, script_content required" }, { status: 400 });
  }

  const cleanUrl = upload_url.replace(/\{[^}]+\}/, '') + `?name=${encodeURIComponent(filename)}`;
  const fileBytes = new TextEncoder().encode(script_content);

  const uploadRes = await fetch(cleanUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/octet-stream",
    },
    body: fileBytes,
  });

  const data = await uploadRes.json();
  return Response.json({ ok: uploadRes.ok, status: uploadRes.status, asset: data });
});