import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Clock3, PackageCheck, Star, ExternalLink, X, Check } from "lucide-react";

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
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [reviewDismissedToken, setReviewDismissedToken] = useState("");
  const [trackingStampImage, setTrackingStampImage] = useState("");
  const [accountOrders, setAccountOrders] = useState<Tracking[]>([]);
  const [accountLoading, setAccountLoading] = useState(true);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<number | null>(null);
  const [accountSignedIn, setAccountSignedIn] = useState(false);
  useEffect(() => { let active = true; fetch(SUPABASE_URL + "/rest/v1/site_images?select=image_url&slot=eq.tracking-stamp-logo", { headers: { apikey: SUPABASE_KEY || "" }, cache: "no-store" }).then(res => res.ok ? res.json() : []).then(rows => { if (active && rows?.[0]?.image_url) setTrackingStampImage(rows[0].image_url); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { let active=true; (async()=>{setAccountLoading(true);try{const raw=localStorage.getItem("brasilpizzas:customer-auth:v1");if(!raw){if(active){setAccountSignedIn(false);setAccountOrders([]);}return;}let auth=JSON.parse(raw);if(!auth?.user?.id||!auth?.access_token){if(active)setAccountSignedIn(false);return;}if(auth.expires_at&&auth.expires_at<Date.now()+60000&&auth.refresh_token){const rr=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:SUPABASE_KEY||"","Content-Type":"application/json"},body:JSON.stringify({refresh_token:auth.refresh_token})});if(rr.ok){const n=await rr.json();auth={...auth,...n,user:n.user||auth.user,expires_at:n.expires_at?n.expires_at*1000:Date.now()+((n.expires_in||3600)*1000)};localStorage.setItem("brasilpizzas:customer-auth:v1",JSON.stringify(auth));}}const res=await fetch(SUPABASE_URL+"/rest/v1/orders?customer_id=eq."+encodeURIComponent(auth.user.id)+"&select=order_number,status,payment_status,created_at,updated_at,estimated_delivery_at,order_items(product_name,quantity)&order=created_at.desc&limit=20",{headers:{apikey:SUPABASE_KEY||"",Authorization:"Bearer "+auth.access_token},cache:"no-store"});if(res.ok){const rows=await res.json();if(active){setAccountSignedIn(true);setAccountOrders(rows);const latest=rows.find((o:Tracking)=>!["delivered","cancelled"].includes(o.status))||rows[0];if(latest)setSelectedOrderNumber(latest.order_number);}}else if(active)setAccountSignedIn(false);}catch{if(active)setAccountSignedIn(false);}finally{if(active)setAccountLoading(false);}})();return()=>{active=false;};}, []);

  useEffect(()=>{try{setReviewDismissedToken(localStorage.getItem(REVIEW_DISMISSED_STORAGE_KEY)||"");}catch{}},[]);
  useEffect(()=>{if(!selectedOrderNumber||!accountSignedIn)return;const refresh=async()=>{try{const raw=localStorage.getItem("brasilpizzas:customer-auth:v1");if(!raw)return;const auth=JSON.parse(raw);const res=await fetch(SUPABASE_URL+"/rest/v1/orders?customer_id=eq."+encodeURIComponent(auth.user.id)+"&order_number=eq."+selectedOrderNumber+"&select=order_number,status,payment_status,created_at,updated_at,estimated_delivery_at,order_items(product_name,quantity)",{headers:{apikey:SUPABASE_KEY||"",Authorization:"Bearer "+auth.access_token},cache:"no-store"});if(res.ok){const rows=await res.json();if(rows[0])setTracking(rows[0]);}}catch{}};void refresh();const timer=window.setInterval(refresh,20000);return()=>window.clearInterval(timer);},[selectedOrderNumber,accountSignedIn]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f2e9] px-4 py-10 text-[#174d38]">
      <div className="relative mx-auto min-h-[620px] max-w-xl">
        <a href="/" className="relative z-20 mb-8 inline-flex items-center gap-2 text-sm text-[#64746a] hover:text-[#174d38]"><ArrowLeft size={16}/> Voltar à Brasil Pizzas</a>
        {trackingStampImage && <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[90px] z-0 h-[285px] w-[285px] -translate-x-1/2 sm:left-[-190px] sm:top-[105px] sm:h-[490px] sm:w-[490px] sm:translate-x-0"><svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full animate-[spin_28s_linear_infinite] overflow-visible"><defs><path id="tracking-stamp-circle" d="M 200,200 m -153,0 a153,153 0 1,1 306,0 a153,153 0 1,1 -306,0"/></defs><text fill="#762f2f" fontSize="18" fontWeight="700" letterSpacing="3.1"><textPath href="#tracking-stamp-circle" startOffset="0%">BRASIL PIZZAS · BRASIL PIZZAS · BRASIL PIZZAS · BRASIL PIZZAS · BRASIL PIZZAS · BRASIL PIZZAS · </textPath></text></svg><img src={trackingStampImage} alt="" className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-90"/></div>} 
        <section className="relative z-10 mx-auto mt-[205px] max-w-xl rounded-2xl border border-[#e4ddca] bg-white/95 p-6 shadow-xl shadow-[#174d38]/5 backdrop-blur-sm sm:mt-[130px] sm:p-8">
          <p className="text-xs font-semibold tracking-[.25em] text-[#9b7930]">BRASIL PIZZAS</p>
          <h1 className="mt-2 text-3xl font-semibold">Acompanhe seu pedido</h1>
          
          {accountLoading?<p className="mt-6 text-sm text-[#64746a]">Carregando seus pedidos…</p>:!accountSignedIn?<div className="mt-6 rounded-xl bg-[#f5f2e9] p-4 text-sm"><b>Entre na sua conta para acompanhar seus pedidos.</b><p className="mt-1 text-[#64746a]">O acompanhamento e o histórico ficam disponíveis na sua conta.</p><a href="/" className="mt-3 inline-flex rounded-lg bg-[#b71924] px-4 py-2.5 font-bold text-white">Entrar na minha conta</a></div>:accountOrders.length===0?<div className="mt-6 rounded-xl bg-[#f5f2e9] p-4 text-sm"><b>Você ainda não tem pedidos registrados.</b><a href="/" className="mt-2 block font-semibold text-[#b71924] underline">Ver cardápio</a></div>:<div className="mt-6 space-y-5"><select value={selectedOrderNumber??""} onChange={e=>setSelectedOrderNumber(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-[#d9dfd8] bg-white px-3 py-3">{accountOrders.map(o=><option key={o.order_number} value={o.order_number}>Pedido #{o.order_number} · {new Date(o.created_at).toLocaleDateString("pt-BR")} · {statusLabels[o.status]||o.status}</option>)}</select></div>}
          {tracking&&<div className="mt-7 border-t border-[#edf0eb] pt-6"><div className="flex items-center justify-between gap-3"><div></div><span className="rounded-full bg-[#e4eee6] px-3 py-2 text-xs font-semibold">{statusLabels[tracking.status]||tracking.status}</span></div><div className="mt-6 rounded-xl bg-[#f8f6f0] p-4 sm:p-5"><p className="mb-5 text-sm font-semibold">Acompanhe as etapas</p>{tracking.status==="cancelled"?<p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">Pedido cancelado</p>:<div>{[{status:"received",label:"Pedido recebido",detail:"Recebemos seu pedido."},{status:"confirmed",label:"Pedido confirmado",detail:"Pedido confirmado pela pizzaria."},{status:"preparing",label:"Em preparação",detail:"Estamos preparando com carinho."},{status:"out_for_delivery",label:"Saiu para entrega",detail:"Seu pedido está a caminho!"},{status:"delivered",label:"Entregue",detail:"Bom apetite! ❤️"}].map((step,index,arr)=>{const steps=["received","confirmed","preparing","out_for_delivery","delivered"];const current=steps.indexOf(tracking.status),pos=steps.indexOf(step.status),done=current>=pos,active=current===pos;return <div key={step.status} className="flex gap-3"><div className="flex w-6 shrink-0 flex-col items-center"><span className={"mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 "+(done?"border-[#762f2f] bg-[#762f2f] text-white":"border-[#c9cfc8] bg-white")}>{done?<Check size={12}/>:<span className="h-1.5 w-1.5 rounded-full bg-[#c9cfc8]"/>}</span>{index<arr.length-1&&<span className={"my-1 min-h-8 w-0.5 flex-1 "+(current>pos?"bg-[#762f2f]":"bg-[#d8ddd6]")}/>}</div><div className={"pb-5 "+(active?"":"opacity-75")}><p className={"text-sm font-semibold "+(active?"text-[#762f2f]":"text-[#174d38]")}>{step.label}{active&&<span className="ml-2 rounded-full bg-[#762f2f]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#762f2f]">Atual</span>}</p><p className="mt-0.5 text-xs text-[#64746a]">{step.detail}</p></div></div>})}</div>}<p className="mt-3 flex items-center gap-2 text-xs text-[#64746a]"><Clock3 size={14}/> Atualizado automaticamente a cada 20 segundos</p><p className="mt-1 text-xs text-[#64746a]">Última atualização: {new Date(tracking.updated_at).toLocaleString("pt-BR")}</p>{tracking.estimated_delivery_at&&<p className="mt-1 text-xs">Previsão: {new Date(tracking.estimated_delivery_at).toLocaleString("pt-BR")}</p>}</div><div className="mt-5 space-y-2 text-sm">{tracking.order_items?.map((item,i)=><div key={i} className="flex justify-between"><span>{item.quantity}× {item.product_name}</span><PackageCheck size={15}/></div>)}</div><div className="mt-4 rounded-xl border border-[#e4eee6] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#64746a]">Pagamento</p><p className="mt-1 text-sm font-semibold">{paymentLabels[tracking.payment_status]||"Status não informado"}</p></div>{tracking.status==="delivered"&&reviewDismissedToken!=="order:"+tracking.order_number&&<section className="tracking-review-card mt-5"><button type="button" className="tracking-review-dismiss" aria-label="Fechar convite" onClick={()=>{setReviewDismissedToken("order:"+tracking.order_number);try{localStorage.setItem(REVIEW_DISMISSED_STORAGE_KEY,"order:"+tracking.order_number);}catch{}}}><X size={17}/></button><div className="tracking-review-celebration">{[1,2,3,4,5].map(n=><span className="tracking-review-star" key={n}><Star/></span>)}</div><p className="tracking-review-kicker">PEDIDO ENTREGUE · OBRIGADO ❤️</p><h3>Esperamos que tenha aproveitado cada pedaço!</h3><p className="tracking-review-copy">Sua opinião ajuda a Brasil Pizzas a crescer e a levar mais momentos gostosos até você.</p><a className="tracking-review-cta" href="https://www.google.com/search?q=Brasil+Pizzas+Recife+avaliar+Google" target="_blank" rel="noopener noreferrer"><Star size={17} fill="currentColor"/> Avaliar nossa pizzaria no Google <ExternalLink size={15}/></a><button className="tracking-review-later" onClick={()=>{setReviewDismissedToken("order:"+tracking.order_number);try{localStorage.setItem(REVIEW_DISMISSED_STORAGE_KEY,"order:"+tracking.order_number);}catch{}}}>Agora não</button></section>}<button type="button" onClick={()=>window.location.reload()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><RefreshCw size={15}/> Atualizar agora</button></div>}
        </section>
      </div>
    </main>
  );
}
