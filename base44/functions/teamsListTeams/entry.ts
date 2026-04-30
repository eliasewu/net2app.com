import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("microsoft_teams");

    // List all groups that are Teams-enabled
    const res = await fetch("https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$select=id,displayName,mail", {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const data = await res.json();

    return Response.json({ teams: data.value || [], raw: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});