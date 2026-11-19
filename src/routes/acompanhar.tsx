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
  const [trackingToken, setTrackingToken] = useState("");
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);  const [reviewDismissedToken, setReviewDismissedToken] = useState("");

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("codigo");
    if (initial) {
      setToken(initial);
      void lookup(initial);
    }
  }, [lookup]);

  useEffect(() => {
    if (!tracking) return;
    const timer = window.setInterval(() => { void lookup(trackingToken); }, 20000);
    return () => window.clearInterval(timer);
  }, [tracking, trackingToken, lookup]);

  return (
    <main className="min-h-screen bg-[#f5f2e9] px-4 py-10 text-[#174d38]">
      <div className="mx-auto max-w-xl">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#64746a] hover:text-[#174d38]"><ArrowLeft size={16}/> Voltar à Brasil Pizzas</a>
        <section className="rounded-2xl border border-[#e4ddca] bg-white p-6 shadow-xl shadow-[#174d38]/5 sm:p-8">
          <p className="text-xs font-semibold tracking-[.25em] text-[#9b7930]">BRASIL PIZZAS</p>
          <h1 className="mt-2 text-3xl font-semibold">Acompanhe seu pedido</h1>
          <p className="mt-2 text-sm text-[#64746a]">Informe o código privado que recebeu ao finalizar o pedido. Ele permite consultar somente o seu pedido.</p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void lookup(token); }}>
            <input value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="Cole seu código de acompanhamento" autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-[#d9dfd8] px-3 py-3 text-sm outline-none focus:border-[#174d38]"/>
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#174d38] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"><Search size={16}/>{busy ? "Consultando..." : "Consultar"}</button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {tracking && <div className="mt-7 border-t border-[#edf0eb] pt-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-[#9b7930]">PEDIDO</p><h2 className="text-2xl font-semibold">#{tracking.order_number}</h2></div><span className="rounded-full bg-[#e4eee6] px-3 py-2 text-xs font-semibold">{statusLabels[tracking.status] || tracking.status}</span></div>
            <div className="mt-5 space-y-3">{tracking.order_items?.map((item, index) => <div key={index} className="flex items-center justify-between text-sm"><span>{item.quantity}x {item.product_name}</span><PackageCheck size={16}/></div>)}</div>
            <div className="mt-5 rounded-xl border border-[#e4eee6] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#64746a]">Pagamento</p><p className="mt-1 text-sm font-semibold">{paymentLabels[tracking.payment_status] || "Status não informado"}</p></div>
            <div className="mt-5 rounded-xl bg-[#f5f2e9] p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><Clock3 size={16}/> Atualização automática a cada 20 segundos</p><p className="mt-2 text-[#64746a]">Última atualização: {new Date(tracking.updated_at).toLocaleString("pt-BR")}</p>{tracking.estimated_delivery_at && <p className="mt-1">Previsão: {new Date(tracking.estimated_delivery_at).toLocaleString("pt-BR")}</p>}</div>
            {tracking.status === "delivered" && reviewDismissedToken !== trackingToken && <section className="tracking-review-card" aria-label="Convite para avaliar a Brasil Pizzas">
              <button type="button" className="tracking-review-dismiss" aria-label="Fechar convite" onClick={() => setReviewDismissedToken(trackingToken)}><X size={17}/></button>
              <div className="tracking-review-celebration" aria-hidden="true"><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span><span className="tracking-review-star"><Star/></span></div>
              <p className="tracking-review-kicker">PEDIDO ENTREGUE · OBRIGADO ❤️</p>
              <h3>Esperamos que tenha aproveitado cada pedaço!</h3>
              <p className="tracking-review-copy">Sua opinião ajuda a Brasil Pizzas a crescer e a levar mais momentos gostosos até você.</p>
              <a className="tracking-review-cta" href="https://www.google.com/search?q=Brasil+Pizzas+Recife+avaliar+Google" target="_blank" rel="noopener noreferrer"><Star size={17} fill="currentColor"/> Avaliar nossa pizzaria no Google <ExternalLink size={15}/></a>
              <button type="button" className="tracking-review-later" onClick={() => setReviewDismissedToken(trackingToken)}>Agora não</button>
            </section>}
            <button type="button" onClick={() => void lookup(trackingToken)} disabled={busy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><RefreshCw size={15}/> Atualizar agora</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
