# ADM Campaigns

The ADM campaign composer queues promotional messages only for customer profiles that opted in on the selected channel.

Email: requires marketing_email=true and an email address.
WhatsApp: requires marketing_whatsapp=true and a phone number.

Set the dispatch Edge Function secret WA_PROMO_TEMPLATE to a Meta-approved template name.
Suggested WhatsApp template body (3 placeholders): Olá {{1}}! {{2}}. {{3}}. Brasil Pizzas — O sabor que aproxima.
Variables are customer name, campaign title, and campaign text. Meta must approve the template before sending.

Campaigns are inserted into customer_notification_queue and sent by dispatch-notifications. That dispatcher is deployed, but scheduling and provider secrets still need configuration.