import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const recipientName = body.recipient_name || 'the recipient';

    await base44.integrations.Core.SendEmail({
      from_name: 'You Remembered, by Gem',
      to: user.email,
      subject: 'Gift list rejected',
      body: `Gift list for ${recipientName} has been rejected.`,
    });

    return Response.json({ status: 'sent' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});