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
    const normalizeNeighborhood = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
    const { data: zones, error: zonesError } = await db.from("delivery_zones").select("municipality,neighborhood,fee,active");
    if (zonesError) throw zonesError;
    const requestedMunicipality = normalizeNeighborhood(municipality);
    const requestedNeighborhood = normalizeNeighborhood(neighborhood);
    const deliveryZone = (zones || []).find((zone) => zone.active && normalizeNeighborhood(zone.municipality) === requestedMunicipality && normalizeNeighborhood(zone.neighborhood) === requestedNeighborhood);
    if ((zones || []).length > 0 && !deliveryZone) return respond(422, { error: "Ainda não atendemos esse bairro. Confira o nome ou fale conosco pelo WhatsApp para consultar a área de entrega." });
    const deliveryFee = deliveryZone ? Number(deliveryZone.fee) : null;
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
      customer_name, customer_phone, street, street_number, municipality, neighborhood, reference: reference || null,
      payment_method, notes: notes || null, subtotal, delivery_fee: deliveryFee, total: Number((subtotal + (deliveryFee ?? 0)).toFixed(2)),
      status: "received", payment_status: "pending", tracking_token_hash: tokenHash,
    }).select("id,order_number,created_at").single();
    if (orderError) throw orderError;

    const { error: itemsError } = await db.from("order_items").insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await db.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }
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
