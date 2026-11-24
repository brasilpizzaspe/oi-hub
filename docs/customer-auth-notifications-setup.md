# Brasil Pizzas — Customer auth & notifications setup

## Auth providers
1. Supabase Dashboard → Authentication → Providers → enable Email (password sign-up) and Google.
2. In Google Cloud, create OAuth Web credentials. Authorized redirect URI: `https://scocgrreppdbtqctesio.supabase.co/auth/v1/callback`.
3. Add Google Client ID/Secret in Supabase's Google provider settings.
4. Authentication → URL Configuration: Site URL `https://brasil-pizzas.lovable.app`; add this site as an allowed redirect URL.
5. Email/password registration has no code entry screen. If email confirmation is enabled, users confirm through a link then sign in.

## Notification secrets
Set these Edge Function secrets in Supabase Dashboard → Edge Functions → Secrets:
- `NOTIFICATION_DISPATCH_SECRET` — a long random secret; also used as the dispatcher HTTP Bearer.
- `RESEND_API_KEY` and `EMAIL_FROM` — verified Resend account/sender.
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optional `WHATSAPP_API_VERSION` (default `v23.0`).
- `WA_ORDER_CONFIRMATION_TEMPLATE`, `WA_POST_SALE_TEMPLATE`, `WA_ORDER_STATUS_TEMPLATE` — names of approved WhatsApp templates.

## WhatsApp template bodies (Portuguese, category Utility)
- Order confirmation: `Olá {{1}}! Seu pedido #{{2}} foi confirmado. Total: {{3}}. Acompanhe: {{4}}. Brasil Pizzas.`
- Post-sale (sent 90 minutes after order creation): `Olá {{1}}, obrigado por escolher a Brasil Pizzas! Esperamos que tenha gostado. Pedido #{{2}}. O sabor que aproxima.`
- Status update: `Olá {{1}}, atualização do pedido #{{2}}: {{3}}.`

Submit and approve these templates in Meta WhatsApp Manager before outbound messages can be delivered. The code queues WhatsApp template messages; it does not send arbitrary outbound text.

## Dispatch schedule
The `dispatch-notifications` Edge Function is deployed. It needs a scheduled invocation (e.g. Supabase Cron + pg_net every minute) with the Bearer secret above. This project currently has no pg_cron/pg_net enabled and the tool connection cannot set Edge Function secrets, so delivery scheduling is not yet active.

The queue retries failed delivery attempts up to 3 times, stores the last error, and cancels pending post-sale messages for cancelled orders.

## Consent
Promotional consent is saved in the customer profile as email/WhatsApp flags. The 90-minute thank-you message is a post-purchase service message and is queued for both channels; campaigns should use the marketing flags and separate consent controls.
