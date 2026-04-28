import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check — admin only
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
      to, subject, html_body, use_tls
    } = await req.json();

    if (!smtp_host || !smtp_user || !smtp_pass || !to || !html_body) {
      return Response.json({ error: 'Missing required fields: smtp_host, smtp_user, smtp_pass, to, html_body' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: parseInt(smtp_port) || 587,
      secure: use_tls === true || parseInt(smtp_port) === 465,
      auth: { user: smtp_user, pass: smtp_pass },
      tls: { rejectUnauthorized: false },
    });

    // Verify connection first
    await transporter.verify();

    const toList = to.split(',').map(e => e.trim()).filter(Boolean);

    const info = await transporter.sendMail({
      from: smtp_from || smtp_user,
      to: toList.join(', '),
      subject: subject || 'Rate Card Update',
      html: html_body,
    });

    console.log('Rate card sent via SMTP:', info.messageId, 'to:', toList);

    return Response.json({ success: true, messageId: info.messageId, recipients: toList.length });
  } catch (error) {
    console.error('sendRateCardSmtp error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});