import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function clean(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : "";
  const result = value.trim();
  if ((required && !result) || result.length > max) return null;
  return result;
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "Método não permitido." });
  try {
    const body = await req.json();
    if (body?.action === "track") {
      const token = clean(body.token, 128, true);
      if (!token || !/^[a-f0-9]{64}$/i.test(token)) return respond(400, { error: "Código de acompanhamento inválido." });
      const tokenHash = await sha256(token);
      const { data: order, error } = await db.from("orders")
        .select("order_number,status,payment_status,created_at,updated_at,estimated_delivery_at,order_items(product_name,quantity)")
        .eq("tracking_token_hash", tokenHash).maybeSingle();
      if (error) throw error;
      if (!order) return respond(404, { error: "Pedido não encontrado." });
      return respond(200, { order });
    }

    if (body?.action !== "create") return respond(400, { error: "Ação inválida." });
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!bearer) return respond(401, { error: "Entre na sua conta para finalizar o pedido." });
    const { data: authData, error: authError } = await db.auth.getUser(bearer);
    if (authError || !authData.user) return respond(401, { error: "Sua sessão expirou. Entre novamente para continuar." });
    const customerId = authData.user.id;
    const customerEmail = authData.user.email || "";
    const marketingEmail = body?.marketing_consent?.email === true;
    const marketingWhatsApp = body?.marketing_consent?.whatsapp === true;

    const customer_name = clean(body.customer?.name, 100, true);
    const customer_phone = clean(body.customer?.phone, 30, true);
    const street = clean(body.customer?.street, 160, true);
    const street_number = clean(body.customer?.number, 30, true);
    const municipality = clean(body.customer?.municipality, 100, true);
    const neighborhood = clean(body.customer?.neighborhood, 100, true);
    const reference = clean(body.customer?.reference, 200);
    const notes = clean(body.notes, 500);
    const payment_method = clean(body.payment_method, 40, true);
    if (!customer_name || !customer_phone || !street || !street_number || !municipality || !neighborhood || !payment_method || notes === null || reference === null) {
      return respond(400, { error: "Confira os dados obrigatórios e os limites dos campos." });
    }
    const phoneDigits = customer_phone.replace(/\D/g, "");
    const normalizeNeighborhood = (value: string) => { const roman: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" }; return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).map((token) => roman[token] || token).join(" "); };
    const { data: zones, error: zonesError } = await db.from("delivery_zones").select("municipality,neighborhood,fee,estimated_distance_km,eta_minutes,active");
    if (zonesError) throw zonesError;
    const requestedMunicipality = normalizeNeighborhood(municipality);
    const requestedNeighborhood = normalizeNeighborhood(neighborhood);
    const deliveryZone = (zones || []).find((zone) => zone.active && normalizeNeighborhood(zone.municipality) === requestedMunicipality && normalizeNeighborhood(zone.neighborhood) === requestedNeighborhood);
    if ((zones || []).length > 0 && !deliveryZone) return respond(422, { error: "Ainda não atendemos esse bairro. Confira o nome ou fale conosco pelo WhatsApp para consultar a área de entrega." });
    const savedNeighborhood = deliveryZone?.neighborhood || neighborhood;
    const deliveryFee = deliveryZone ? Number(deliveryZone.fee) : null;
    const etaMinutes = deliveryZone ? Number(deliveryZone.eta_minutes) : null;
    if (deliveryFee !== null && (!Number.isFinite(deliveryFee) || deliveryFee < 0)) return respond(500, { error: "A taxa deste bairro está configurada incorretamente. Entre em contato com a loja." });

    if (!/^[+()\d\s.-]+$/.test(customer_phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      return respond(400, { error: "Informe um telefone válido com DDD." });
    }
    if (!["Pix", "Dinheiro", "Cartão na entrega"].includes(payment_method)) {
      return respond(400, { error: "Forma de pagamento inválida." });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      return respond(400, { error: "O pedido deve conter de 1 a 20 produtos." });
    }
    const quantities = new Map<string, number>();
    for (const item of body.items) {
      const id = clean(item?.product_id, 80, true);
      const quantity = Number(item?.quantity);
      if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return respond(400, { error: "Produto ou quantidade inválida." });
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    if (quantities.size > 20 || [...quantities.values()].some((q) => q > 20)) {
      return respond(400, { error: "Quantidade total por produto excedida." });
    }

    // Apply the per-IP limit only after cheap request validation, so malformed
    // payloads cannot consume a customer's valid-order allowance.
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256(ip.slice(0, 128));
    const { data: allowed, error: limitError } = await db.rpc("consume_order_rate_limit", { p_ip_hash: ipHash });
    if (limitError) throw limitError;
    if (allowed !== true) return respond(429, { error: "Muitos pedidos enviados deste acesso. Aguarde alguns minutos e tente novamente." });

    const { data: products, error: productError } = await db.from("products")
      .select("id,name,price,active").in("id", [...quantities.keys()]);
    if (productError) throw productError;
    if (!products || products.length !== quantities.size || products.some((p) => !p.active || p.price === null || Number(p.price) <= 0)) {
      return respond(409, { error: "Um ou mais produtos estão indisponíveis ou sem preço cadastrado." });
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    const orderItems = [...quantities.entries()].map(([id, quantity]) => {
      const p = productMap.get(id)!;
      const unitPrice = Number(p.price);
      return { product_id: id, product_name: p.name, quantity, unit_price: unitPrice, line_total: Number((unitPrice * quantity).toFixed(2)) };
    });
    const subtotal = Number(orderItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
    const token = randomToken();
    const tokenHash = await sha256(token);

    const { data: order, error: orderError } = await db.from("orders").insert({
      customer_name, customer_phone, street, street_number, municipality, neighborhood: savedNeighborhood, reference: reference || null,
      payment_method, notes: notes || null, subtotal, delivery_fee: deliveryFee, total: Number((subtotal + (deliveryFee ?? 0)).toFixed(2)),
      status: "received", payment_status: "pending", tracking_token_hash: tokenHash, customer_id: customerId,
    }).select("id,order_number,created_at,estimated_delivery_at").single();
    if (orderError) throw orderError;

    const { error: itemsError } = await db.from("order_items").insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await db.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }
    // Persist account data and enqueue transactional notifications and opted-in post-sale at 90 minutes.
    try {
      await db.from("customer_profiles").upsert({
        user_id: customerId, email: customerEmail, full_name: customer_name, phone: customer_phone,
        marketing_email: marketingEmail, marketing_whatsapp: marketingWhatsApp, default_address: { street, number: street_number, municipality, neighborhood: savedNeighborhood, reference: reference || "" }, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      const { data: savedAddresses, error: savedAddressesError } = await db.from("customer_addresses")
        .select("id,label,street,street_number,municipality,neighborhood,reference,is_default")
        .eq("user_id", customerId);
      if (!savedAddressesError) {
        const normalizeAddressPart = (value: string) => normalizeNeighborhood(value);
        const existingAddress = (savedAddresses || []).find((address) =>
          normalizeAddressPart(address.street) === normalizeAddressPart(street) &&
          normalizeAddressPart(address.street_number) === normalizeAddressPart(street_number) &&
          normalizeAddressPart(address.municipality) === normalizeAddressPart(municipality) &&
          normalizeAddressPart(address.neighborhood) === normalizeAddressPart(savedNeighborhood)
        );
        const addressRecord = { label: existingAddress?.label || "Pedido", street, street_number, municipality, neighborhood: savedNeighborhood, reference: reference || "", updated_at: new Date().toISOString() };
        if (existingAddress) {
          await db.from("customer_addresses").update(addressRecord).eq("id", existingAddress.id).eq("user_id", customerId);
        } else {
          await db.from("customer_addresses").insert({ user_id: customerId, ...addressRecord, is_default: (savedAddresses || []).length === 0 });
        }
      }
      const trackingUrl = "https://brasil-pizzas.lovable.app/acompanhar?codigo=" + token;
      const now = new Date();
      const postSale = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
      const orderPayload = { customer_name, order_number: order.order_number, total: Number((subtotal + (deliveryFee ?? 0)).toFixed(2)), tracking_url: trackingUrl };
      const rows = [
        { order_id: order.id, customer_id: customerId, channel: "whatsapp", message_type: "order_confirmation", recipient: customer_phone, payload: orderPayload, scheduled_at: now.toISOString() },
        ...(customerEmail ? [{ order_id: order.id, customer_id: customerId, channel: "email", message_type: "order_confirmation", recipient: customerEmail, payload: orderPayload, scheduled_at: now.toISOString() }] : []),
        { order_id: order.id, customer_id: customerId, channel: "whatsapp", message_type: "post_sale_thanks", recipient: customer_phone, payload: { customer_name, order_number: order.order_number, tracking_url: trackingUrl }, scheduled_at: postSale },
        ...(customerEmail ? [{ order_id: order.id, customer_id: customerId, channel: "email", message_type: "post_sale_thanks", recipient: customerEmail, payload: { customer_name, order_number: order.order_number, tracking_url: trackingUrl }, scheduled_at: postSale }] : []),
      ];
      const { error: queueError } = await db.from("customer_notification_queue").insert(rows);
      if (queueError) console.error("notification queue insert error", queueError);
    } catch (queueFailure) { console.error("customer profile/queue error", queueFailure); }

    return respond(201, {
      order_number: order.order_number,
      tracking_token: token,
      subtotal,
      delivery_fee: deliveryFee,
      total: Number((subtotal + (deliveryFee ?? 0)).toFixed(2)),
      status: "received",
      payment_status: "pending",
      created_at: order.created_at,
    });
  } catch (error) {
    console.error("create-order error", error);
    return respond(500, { error: "Não foi possível processar o pedido agora. Tente novamente." });
  }
});
