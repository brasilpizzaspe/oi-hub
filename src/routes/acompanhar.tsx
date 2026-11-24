import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Clock3, PackageCheck, Star, ExternalLink, X } from "lucide-react";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
const statusLabels: Record<string, string> = {
  received: "Pedido recebido",
  confirmed: "Pedido confirmado",
  preparing: "Em preparação",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const paymentLabels: Record<string, string> = { pending: "Aguardando confirmação", approved: "Aprovado", failed: "Não aprovado", refunded: "Estornado" };
const TRACKING_STORAGE_KEY = "brasilpizzas:last-tracking-token:v1";
const REVIEW_DISMISSED_STORAGE_KEY = "brasilpizzas:review-dismissed-token:v1";
type Tracking = {
  order_number: number;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  estimated_delivery_at: string | null;
  order_items: { product_name: string; quantity: number }[];
};

export const Route = createFileRoute("/acompanhar")({
  component: TrackOrder,
  head: () => ({ meta: [{ title: "Acompanhar pedido | Brasil Pizzas" }, { name: "robots", content: "noindex,nofollow,noarchive" }] }),
});

function TrackOrder() {
  const [token, setToken] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [trackingOrderNumber, setTrackingOrderNumber] = useState("");
  const [trackingPhone, setTrackingPhone] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewDismissedToken, setReviewDismissedToken] = useState("");

  const lookup = useCallback(async (value: string) => {
    const cleanToken = value.trim();
    if (!/^[a-f0-9]{64}$/i.test(cleanToken)) {
      setError("Digite o código privado de 64 caracteres que recebeu ao registrar o pedido.");
      setTracking(null);
      setTrackingToken("");
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setError("O acompanhamento ainda não está configurado.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/orders", {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "track", token: cleanToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível localizar o pedido.");
      setTracking(payload.order);
      try { localStorage.setItem(TRACKING_STORAGE_KEY, cleanToken); } catch {}
      setTrackingToken(cleanToken);
      setError("");
    } catch (e) {
      setTracking(null);
      setTrackingToken("");
      setError(e instanceof Error ? e.message : "Erro ao consultar o pedido.");
    } finally {
      setBusy(false);
    }
  }, []);

  const lookupByOrder = useCallback(async (orderValue: string, phoneValue: string) => {
    const orderDigits = orderValue.trim();
    const phoneDigits = phoneValue.replace(/[^0-9]/g, "");
    if (!/^[0-9]+$/.test(orderDigits) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Informe o número do pedido e o WhatsApp usado na compra.");
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) { setError("O acompanhamento ainda não está configurado."); return; }
    setBusy(true);
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/orders", {
        method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "track_by_order", order_number: Number(orderDigits), phone: phoneValue }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível localizar o pedido.");
      setTracking(payload.order); setTrackingOrderNumber(orderDigits); setTrackingPhone(phoneValue); setTrackingToken(""); setError("");
    } catch (e) {
      setTracking(null); setTrackingOrderNumber(""); setTrackingPhone("");
      setError(e instanceof Error ? e.message : "Erro ao consultar o pedido.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let initial = params.get("codigo");
    const orderFromLink = params.get("pedido");
    let phoneFromLink = params.get("telefone") || "";
    if (!phoneFromLink) { try { phoneFromLink = sessionStorage.getItem("brasilpizzas:tracking-phone") || ""; } catch {} }
    if (orderFromLink) {
      setOrderNumber(orderFromLink);
      if (phoneFromLink) {
        setPhone(phoneFromLink);
        setError("");
        void lookupByOrder(orderFromLink, phoneFromLink);
      }
    }
    if (!initial && !orderFromLink) { try { initial = localStorage.getItem(TRACKING_STORAGE_KEY); } catch {} }
    try { setReviewDismissedToken(localStorage.getItem(REVIEW_DISMISSED_STORAGE_KEY) || ""); } catch {}
    if (initial) {
      setToken(initial);
      void lookup(initial);
    }
  }, [lookup, lookupByOrder]);

  useEffect(() => {
    if (!tracking) return;
    const timer = window.setInterval(() => { if (trackingToken) void lookup(trackingToken); else if (trackingOrderNumber && trackingPhone) void lookupByOrder(trackingOrderNumber, trackingPhone); }, 20000);
    return () => window.clearInterval(timer);
  }, [tracking, trackingToken, trackingOrderNumber, trackingPhone, lookup, lookupByOrder]);

  return (
    <main className="min-h-screen bg-[#f5f2e9] px-4 py-10 text-[#174d38]">
      <div className="mx-auto max-w-xl">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#64746a] hover:text-[#174d38]"><ArrowLeft size={16}/> Voltar à Brasil Pizzas</a>
        <section className="rounded-2xl border border-[#e4ddca] bg-white p-6 shadow-xl shadow-[#174d38]/5 sm:p-8">
          <p className="text-xs font-semibold tracking-[.25em] text-[#9b7930]">BRASIL PIZZAS</p>
          <h1 className="mt-2 text-3xl font-semibold">Acompanhe seu pedido</h1>
          <p className="mt-2 text-sm text-[#64746a]">Acompanhe usando apenas o número do pedido e o WhatsApp informado na compra — não precisa de código.</p>
          {!tracking && <form className="mt-6 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void lookupByOrder(orderNumber, phone); }}>
            <label className="flex flex-col gap-1 text-sm font-medium">Número do pedido<input inputMode="numeric" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Ex.: 3" autoComplete="off" className="min-w-0 rounded-lg border border-[#d9dfd8] px-3 py-3 text-sm outline-none focus:border-[#174d38]"/></label>
            <label className="flex flex-col gap-1 text-sm font-medium">WhatsApp usado no pedido<input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" autoComplete="tel" className="min-w-0 rounded-lg border border-[#d9dfd8] px-3 py-3 text-sm outline-none focus:border-[#174d38]"/></label>
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b71924] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Search size={16}/>{busy ? "Consultando..." : "Acompanhar pedido"}</button>
          </form>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {tracking && <button type="button" onClick={()=>{setTracking(null);setTrackingOrderNumber("");setTrackingPhone("");setOrderNumber("");setPhone("");setError("");try{sessionStorage.removeItem("brasilpizzas:tracking-phone");}catch{}}} className="mt-4 text-sm font-semibold text-[#b71924] underline underline-offset-4">Consultar outro pedido</button>}
          {tracking && <div className="mt-7 border-t border-[#edf0eb] pt-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-[#9b7930]">PEDIDO</p><h2 className="text-2xl font-semibold">#{tracking.order_number}</h2></div><span className="rounded-full bg-[#e4eee6] px-3 py-2 text-xs font-semibold">{statusLabels[tracking.status] || tracking.status}</span></div>
            <div className="mt-5 space-y-3">{tracking.order_items?.map((item, index) => <div key={index} className="flex items-center justify-between text-sm"><span>{item.quantity}x {item.product_name}</span><PackageCheck size={16}/></div>)}</div>
            <div className="mt-5 rounded-xl border border-[#e4eee6] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#64746a]">Pagamento</p><p className="mt-1 text-sm font-semibold">{paymentLabels[tracking.payment_status] || "Status não informado"}</p></div>
            <div className="mt-5 rounded-xl bg-[#f5f2e9] p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><Clock3 size={16}/> Atualização automática a cada 20 segundos</p><p className="mt-2 text-[#64746a]">Última atualização: {new Date(tracking.updated_at).toLocaleString("pt-BR")}</p>{tracking.estimated_delivery_at && <p className="mt-1">Previsão: {new Date(tracking.estimated_delivery_at).toLocaleString("pt-BR")}</p>}</div>
            {tracking.status === "delivered" && reviewDismissedToken !== (trackingToken || "order:" + tracking.order_number) && <section className="tracking-review-card" aria-label="Convite para avaliar a Brasil Pizzas">
              <button type="button" className="tracking-review-dismiss" aria-label="Fechar convite" onClick={() => { setReviewDismissedToken(trackingToken || "order:" + tracking.order_number); try { localStorage.setItem(REVIEW_DISMISSED_STORAGE_KEY, trackingToken || "order:" + tracking.order_number); } catch {} }}><X size={17}/></button>
              <div className="tracking-review-celebration" aria-hidden="true"><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span></div>
              <p className="tracking-review-kicker">PEDIDO ENTREGUE · OBRIGADO ❤️</p>
              <h3>Esperamos que tenha aproveitado cada pedaço!</h3>
              <p className="tracking-review-copy">Sua opinião ajuda a Brasil Pizzas a crescer e a levar mais momentos gostosos até você.</p>
              <a className="tracking-review-cta" href="https://www.google.com/search?q=Brasil+Pizzas+Recife+avaliar+Google" target="_blank" rel="noopener noreferrer"><Star size={17} fill="currentColor"/> Avaliar nossa pizzaria no Google <ExternalLink size={15}/></a>
              <button type="button" className="tracking-review-later" onClick={() => { const reviewKey = trackingToken || "order:" + tracking.order_number; setReviewDismissedToken(reviewKey); try { localStorage.setItem(REVIEW_DISMISSED_STORAGE_KEY, reviewKey); } catch {} }}>Agora não</button>
            </section>}
            <button type="button" onClick={() => trackingToken ? void lookup(trackingToken) : void lookupByOrder(trackingOrderNumber, trackingPhone)} disabled={busy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><RefreshCw size={15}/> Atualizar agora</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
