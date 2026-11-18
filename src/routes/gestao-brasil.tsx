import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, LogOut, Package, RefreshCw, Save, ShieldCheck, ShoppingBag } from "lucide-react";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://scocgrreppdbtqctesio.supabase.co";
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_JGN8bSFsGCxTOIubmNmHIA_J36i5Mpp";

type Product = { id: string; name: string; category: string; description: string; price: number | null; active: boolean; image_url: string | null };
type OrderItem = { id: string; product_name: string; quantity: number; unit_price: number; line_total: number };
type Order = { id: string; order_number: number; customer_name: string; customer_phone: string; street: string; street_number: string; neighborhood: string; reference: string | null; notes: string | null; subtotal: number; delivery_fee: number | null; total: number; status: string; payment_status: string; payment_method: string; created_at: string; estimated_delivery_at: string | null; order_items: OrderItem[] };
type Session = { access_token: string; refresh_token: string; user: { id: string; email: string } };
const REMEMBERED_EMAIL_KEY = "brasil-pizzas-admin-email";
const PERSISTENT_SESSION_KEY = "brasil-pizzas-admin-session";
type SiteImage = { slot: string; title: string; description: string; recommended_ratio: string; recommended_dimensions: string; image_url: string | null };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toLocalDateTime = (value: string | null) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const statuses = [
  ["received", "Pedido recebido"],
  ["confirmed", "Confirmado"],
  ["preparing", "Em preparação"],
  ["out_for_delivery", "Saiu para entrega"],
  ["delivered", "Entregue"],
  ["cancelled", "Cancelado"],
] as const;

export const Route = createFileRoute("/gestao-brasil")({
  component: PrivateManagement,
  head: () => ({ meta: [{ title: "Acesso restrito" }, { name: "robots", content: "noindex,nofollow,noarchive" }] }),
});

function PrivateManagement() {
  const [email, setEmail] = useState("brasilpizzaspe@gmail.com");
  const [keepConnected, setKeepConnected] = useState(false);
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [siteImages, setSiteImages] = useState<SiteImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "products" | "images">("orders");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function readRecoveryLink() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const type = hash.get("type") || query.get("type");
      const accessToken = hash.get("access_token") || query.get("access_token");
      const tokenHash = query.get("token_hash") || hash.get("token_hash");
      const authError = hash.get("error_description") || query.get("error_description") || hash.get("error_code") || query.get("error_code");

      if (type !== "recovery" && !tokenHash && !authError) return;
      setResetMode(true);

      if (authError) {
        setError("Este link de redefinição expirou ou já foi utilizado. Volte ao login e solicite um novo link.");
        return;
      }
      if (accessToken) {
        setRecoveryToken(accessToken);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        return;
      }
      if (tokenHash && SUPABASE_URL && SUPABASE_KEY) {
        try {
          const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ token_hash: tokenHash, type: "recovery" }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.access_token) throw new Error("O link expirou ou já foi utilizado. Solicite outro.");
          if (!cancelled) {
            setRecoveryToken(payload.access_token);
            window.history.replaceState(null, "", `${window.location.pathname}`);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível validar o link. Solicite outro.");
        }
        return;
      }
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        setError("A conexão do painel com o Supabase ainda não está configurada no site publicado.");
      } else if (type === "recovery") {
        setError("Não foi possível localizar o código de recuperação neste link. Solicite um novo.");
      }
    }
    void readRecoveryLink();
    return () => { cancelled = true; };
  }, []);

  const apiHeaders = useMemo(() => session ? { apikey: SUPABASE_KEY || "", Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" } : null, [session]);

  async function loadDashboard(current: Session) {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("A conexão segura ainda não foi configurada no ambiente do site.");
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.access_token}` };
    const [productResponse, orderResponse, imageResponse] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category,description,price,active,image_url&order=sort_order.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=100`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/site_images?select=slot,title,description,recommended_ratio,recommended_dimensions,image_url`, { headers }),
    ]);
    if (!productResponse.ok || !orderResponse.ok || !imageResponse.ok) throw new Error("Não foi possível carregar os dados da loja. Verifique sua autorização.");
    setProducts(await productResponse.json());
    setOrders(await orderResponse.json());
    setSiteImages(await imageResponse.json());
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("A conexão segura ainda não foi configurada no ambiente do site.");
      const redirectTo = `${window.location.origin}/gestao-brasil`;
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.msg || payload.message || "Não foi possível enviar o link. Confira o e-mail e tente novamente."); }
      setResetSent(true); setNotice("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também o spam.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao solicitar redefinição."); }
    finally { setBusy(false); }
  }

  async function saveNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("A conexão do painel com o Supabase ainda não está configurada no site publicado.");
      if (!recoveryToken) throw new Error("O link de redefinição não foi validado ou expirou. Volte ao login e solicite outro.");
      if (newPassword.length < 8) throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
      if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem.");
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${recoveryToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.msg || payload.message || "Não foi possível alterar a senha. Solicite um novo link.");
      setResetMode(false); setRecoveryToken(""); setNewPassword(""); setConfirmPassword(""); setPassword(""); setNotice("Senha alterada com sucesso. Entre com sua nova senha.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao alterar a senha."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered) setEmail(remembered);
      const saved = window.localStorage.getItem(PERSISTENT_SESSION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Session;
      if (!parsed.refresh_token || !parsed.user?.id) {
        window.localStorage.removeItem(PERSISTENT_SESSION_KEY);
        return;
      }
      setKeepConnected(true);
      void (async () => {
        try {
          const refreshed = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: parsed.refresh_token }),
          });
          const payload = await refreshed.json();
          if (!refreshed.ok || !payload.access_token || !payload.refresh_token || payload.user?.id !== parsed.user.id) throw new Error("Sessão expirada");
          const current: Session = { access_token: payload.access_token, refresh_token: payload.refresh_token, user: { id: payload.user.id, email: payload.user.email } };
          const membership = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(current.user.id)}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.access_token}` },
          });
          const rows = membership.ok ? await membership.json() : [];
          if (!Array.isArray(rows) || rows.length === 0) throw new Error("Acesso não autorizado");
          await loadDashboard(current);
          setSession(current);
          window.localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(current));
        } catch {
          window.localStorage.removeItem(PERSISTENT_SESSION_KEY);
          setKeepConnected(false);
        }
      })();
    } catch {
      window.localStorage.removeItem(PERSISTENT_SESSION_KEY);
    }
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("A conexão segura ainda não foi configurada no ambiente do site.");
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.access_token || !payload.user?.id) throw new Error("E-mail ou senha inválidos, ou acesso não autorizado.");
      const current: Session = { access_token: payload.access_token, refresh_token: payload.refresh_token, user: { id: payload.user.id, email: payload.user.email } };
      const membership = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(current.user.id)}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${current.access_token}` },
      });
      const rows = membership.ok ? await membership.json() : [];
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("Este usuário não possui autorização administrativa.");
      await loadDashboard(current);
      setSession(current); setPassword(""); setNotice("Acesso autorizado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (!session) return;
    setBusy(true); setError("");
    try { await loadDashboard(session); setNotice("Informações atualizadas."); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar."); }
    finally { setBusy(false); }
  }

  async function saveProduct(product: Product) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    if (!product.name.trim() || product.name.trim().length > 100 || product.description.length > 300) {
      setError("Confira o nome e a descrição do produto. O nome é obrigatório (até 100 caracteres) e a descrição aceita até 300.");
      setNotice("");
      return;
    }
    if (!(["Salgadas", "Doces", "Bebidas"] as string[]).includes(product.category)) {
      setError("Selecione uma categoria válida para o produto.");
      setNotice("");
      return;
    }
    if (product.price !== null && (!Number.isFinite(product.price) || product.price <= 0)) {
      setError("Informe um preço maior que zero ou deixe o campo vazio enquanto o preço não estiver definido.");
      setNotice("");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`, {
        method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ name: product.name.trim(), category: product.category, description: product.description.trim(), price: product.price, active: product.active, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar este produto.");
      setNotice(`${product.name} atualizado.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }


  async function uploadImage(file: File, slot: string, product?: Product) {
    if (!session || !SUPABASE_URL || !SUPABASE_KEY) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(file.type)) { setError("Use uma imagem JPG, PNG, WebP ou AVIF."); return; }
    if (file.size > 12 * 1024 * 1024) { setError("A imagem deve ter no máximo 12 MB."); return; }
    setUploadingSlot(slot); setError(""); setNotice("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${slot}/${crypto.randomUUID()}.${ext}`;
      const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/store-images/${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!upload.ok) throw new Error("Não foi possível enviar a imagem. Confira sua conexão e tente novamente.");
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/store-images/${path}`;
      if (product) {
        const saved = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`, {
          method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: publicUrl, updated_at: new Date().toISOString() }),
        });
        if (!saved.ok) throw new Error("Imagem enviada, mas não foi possível vinculá-la ao produto.");
        setProducts(old => old.map(item => item.id === product.id ? { ...item, image_url: publicUrl } : item));
        setNotice(`Imagem de ${product.name} atualizada no site.`);
      } else {
        const saved = await fetch(`${SUPABASE_URL}/rest/v1/site_images?slot=eq.${encodeURIComponent(slot)}`, {
          method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: publicUrl, updated_at: new Date().toISOString() }),
        });
        if (!saved.ok) throw new Error("Imagem enviada, mas não foi possível vinculá-la ao banner.");
        setSiteImages(old => old.map(item => item.slot === slot ? { ...item, image_url: publicUrl } : item));
        setNotice("Imagem do banner atualizada no site.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar imagem."); }
    finally { setUploadingSlot(null); }
  }

  async function updateOrder(order: Order, status: string) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Não foi possível atualizar o pedido.");
      setOrders(old => old.map(item => item.id === order.id ? { ...item, status } : item));
      setNotice(`Pedido #${order.order_number} atualizado.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar."); }
    finally { setBusy(false); }
  }

  async function saveEstimate(order: Order) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ estimated_delivery_at: order.estimated_delivery_at, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar a previsão.");
      setNotice(`Previsão do pedido #${order.order_number} atualizada.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar a previsão."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { void loadDashboard(session).catch(() => undefined); }, 30000);
    return () => window.clearInterval(timer);
  }, [session]);

  if (resetMode) return (
    <main className="min-h-screen bg-[#f5f2e9] px-4 py-12 text-[#174d38]"><div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="text-xs font-semibold tracking-[.28em] text-[#9b7930]">BRASIL PIZZAS</p><h1 className="mt-3 text-3xl font-semibold">Criar nova senha</h1><p className="mt-2 text-sm text-[#64746a]">Escolha uma senha nova para acessar a gestão.</p></div><form onSubmit={saveNewPassword} className="rounded-2xl border border-[#e4ddca] bg-white p-7 shadow-xl"><label className="mb-4 block text-sm font-medium">Nova senha<input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" /></label><label className="mb-5 block text-sm font-medium">Confirme a nova senha<input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" /></label>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-[#174d38] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Salvando..." : "Salvar nova senha"}</button></form></div></main>
  );

  if (!session) return (
    <main className="min-h-screen bg-[#f5f2e9] px-4 py-12 text-[#174d38]">
      <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#174d38] text-[#d6ad48]"><ShieldCheck size={26} /></div>
          <p className="text-xs font-semibold tracking-[.28em] text-[#9b7930]">BRASIL PIZZAS</p>
          <h1 className="mt-3 text-3xl font-semibold">Acesso reservado</h1>
          <p className="mt-2 text-sm text-[#64746a]">Entre com as credenciais autorizadas da loja.</p>
        </div>
        {resetMode ? <form onSubmit={requestPasswordReset} className="rounded-2xl border border-[#e4ddca] bg-white p-7 shadow-xl shadow-[#174d38]/5"><label className="mb-4 block text-sm font-medium">E-mail cadastrado<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" placeholder="seu@email.com" /></label>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mb-4 rounded-lg bg-[#e4eee6] p-3 text-sm text-[#174d38]">{notice}</p>}<button disabled={busy || resetSent} className="w-full rounded-lg bg-[#174d38] px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Enviando..." : resetSent ? "Link solicitado" : "Enviar link de redefinição"}</button><button type="button" onClick={() => { setResetMode(false); setResetSent(false); setError(""); setNotice(""); }} className="mt-4 w-full text-sm text-[#64746a]">Voltar ao login</button></form> : <form onSubmit={signIn} className="rounded-2xl border border-[#e4ddca] bg-white p-7 shadow-xl shadow-[#174d38]/5">
          <label className="mb-4 block text-sm font-medium">E-mail
            <input autoComplete="username" list="admin-email-suggestions" type="email" required value={email} onChange={e => setEmail(e.target.value)} onBlur={e => { if (e.target.value.trim()) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, e.target.value.trim()); }} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3 outline-none focus:border-[#174d38]" placeholder="brasilpizzaspe@gmail.com" /><datalist id="admin-email-suggestions"><option value="brasilpizzaspe@gmail.com" /></datalist>
          </label>
          <label className="mb-5 block text-sm font-medium">Senha
            <input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3 outline-none focus:border-[#174d38]" placeholder="Sua senha" />
          </label>
          <label className="mb-4 flex items-center gap-2 text-sm text-[#64746a]"><input type="checkbox" checked={keepConnected} onChange={e => { setKeepConnected(e.target.checked); if (!e.target.checked) window.localStorage.removeItem(PERSISTENT_SESSION_KEY); }} className="h-4 w-4 accent-[#174d38]" /> Manter conectado neste dispositivo</label>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-[#174d38] px-4 py-3 font-semibold text-white transition hover:bg-[#103b2a] disabled:opacity-60">{busy ? "Verificando..." : "Entrar"}</button>
          <button type="button" onClick={() => { setResetMode(true); setError(""); setNotice(""); }} className="mb-3 w-full text-sm font-medium text-[#9b7930] hover:underline">Esqueci minha senha</button>
          <p className="mt-5 text-center text-xs text-[#879188]">Área privada. Acesso monitorado e restrito.</p>
        </form>}
        <a href="/" className="mt-6 text-center text-sm text-[#64746a] hover:text-[#174d38]">Voltar à página inicial</a>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f5f2e9] text-[#174d38]">
      <header className="border-b border-[#e4ddca] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div><p className="text-xs font-semibold tracking-[.25em] text-[#9b7930]">BRASIL PIZZAS</p><h1 className="text-xl font-semibold">Gestão da loja</h1></div>
          <div className="flex items-center gap-3"><button onClick={() => void refresh()} disabled={busy} className="rounded-lg border border-[#d9dfd8] p-2" aria-label="Atualizar"><RefreshCw size={17}/></button><button onClick={() => { setSession(null); setProducts([]); setOrders([]); setSiteImages([]); window.localStorage.removeItem(PERSISTENT_SESSION_KEY); setKeepConnected(false); setNotice("Você saiu da área administrativa."); setError(""); }} className="flex items-center gap-2 rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm"><LogOut size={16}/> Sair</button></div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[#758177]">Sessão administrativa</p><p className="font-medium">{session.user.email}</p></div><span className="rounded-full bg-[#e4eee6] px-3 py-1 text-xs font-semibold text-[#174d38]">Acesso verificado</span></div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg bg-[#e4eee6] p-3 text-sm text-[#174d38]">{notice}</p>}
        <div className="mb-5 flex gap-2 border-b border-[#e1dac8]"><button onClick={() => setTab("orders")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === "orders" ? "border-[#174d38]" : "border-transparent text-[#7d887f]"}`}><ShoppingBag size={16}/> Pedidos ({orders.length})</button><button onClick={() => setTab("products")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === "products" ? "border-[#174d38]" : "border-transparent text-[#7d887f]"}`}><Package size={16}/> Cardápio ({products.length})</button><button onClick={() => setTab("images")} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === "images" ? "border-[#174d38]" : "border-transparent text-[#7d887f]"}`}>Imagens do site</button></div>
        {tab === "orders" ? <div className="space-y-4">{orders.length === 0 ? <div className="rounded-xl border border-[#e4ddca] bg-white p-8 text-center text-sm text-[#758177]">Nenhum pedido registrado ainda.</div> : orders.map(order => <article key={order.id} className="rounded-xl border border-[#e4ddca] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-[#9b7930]">PEDIDO #{order.order_number}</p><h2 className="mt-1 text-lg font-semibold">{order.customer_name}</h2><p className="text-sm text-[#758177]">{order.customer_phone} · {new Date(order.created_at).toLocaleString("pt-BR")}</p></div><select aria-label={`Status do pedido ${order.order_number}`} value={order.status} disabled={busy} onChange={e => void updateOrder(order, e.target.value)} className="rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-sm">{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-4 grid gap-4 border-t border-[#edf0eb] pt-4 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#879188]">Entrega</p><p className="mt-1 text-sm">{order.street}, {order.street_number} · {order.neighborhood}</p>{order.reference && <p className="text-sm text-[#758177]">Ref.: {order.reference}</p>}<label className="mt-3 block text-xs font-medium text-[#758177]">Previsão de entrega<input type="datetime-local" value={toLocalDateTime(order.estimated_delivery_at)} onChange={e => setOrders(old => old.map(item => item.id === order.id ? { ...item, estimated_delivery_at: e.target.value ? new Date(e.target.value).toISOString() : null } : item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#174d38]"/></label><button disabled={busy} onClick={() => void saveEstimate(order)} className="mt-2 rounded-lg border border-[#d9dfd8] px-3 py-2 text-xs font-semibold disabled:opacity-60">Salvar previsão</button></div><div><p className="text-xs font-semibold uppercase tracking-wide text-[#879188]">Pagamento</p><p className="mt-1 text-sm">{order.payment_method} · {order.payment_status === "approved" ? "Aprovado" : order.payment_status === "pending" ? "Pendente" : order.payment_status}</p><div className="mt-2 space-y-1 text-sm"><p>Subtotal dos itens: {money(Number(order.subtotal))}</p><p>Taxa de entrega: {order.delivery_fee === null ? "A confirmar" : money(Number(order.delivery_fee))}</p><p className="pt-1 font-semibold">{order.delivery_fee === null ? "Subtotal provisório" : "Total do pedido"}: {money(Number(order.total))}</p></div></div></div><div className="mt-3 border-t border-[#edf0eb] pt-3 text-sm">{(order.order_items || []).map(item => <p key={item.id}>{item.quantity}x {item.product_name} — {money(Number(item.line_total))}</p>)}{order.notes && <p className="mt-2 text-[#758177]">Obs.: {order.notes}</p>}</div></article>)}</div> : tab === "products" ? <div className="grid gap-3 md:grid-cols-2">{products.map(product => <article key={product.id} className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="mb-3 overflow-hidden rounded-lg bg-[#f3f1e9]">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-40 w-full object-cover"/> : <div className="flex h-32 items-center justify-center text-xs text-[#879188]">Sem imagem cadastrada</div>}</div><p className="mb-2 text-xs text-[#879188]">Foto de produto · proporção 1:1 · recomendado 1000 × 1000 px</p><label className="mb-3 block text-xs font-medium text-[#758177]">Trocar foto do produto<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!!uploadingSlot} onChange={e => { const file=e.target.files?.[0]; if(file) void uploadImage(file, `product-${product.id}`, product); e.currentTarget.value=""; }} className="mt-1 block w-full text-xs"/></label><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1 space-y-3"><label className="block text-xs font-medium text-[#758177]">Nome do produto<input maxLength={100} value={product.name} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, name: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#174d38]"/></label><label className="block text-xs font-medium text-[#758177]">Categoria<select value={product.category} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, category: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-sm text-[#174d38]"><option>Salgadas</option><option>Doces</option><option>Bebidas</option></select></label><label className="block text-xs font-medium text-[#758177]">Descrição<textarea maxLength={300} value={product.description} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, description: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#174d38]"/></label></div><button aria-label={product.active ? "Ocultar produto" : "Exibir produto"} onClick={() => setProducts(old => old.map(p => p.id === product.id ? { ...p, active: !p.active } : p))} className="rounded-lg border border-[#d9dfd8] p-2">{product.active ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div><label className="mt-4 block text-xs font-medium text-[#758177]">Preço (R$)<input type="number" min="0" step="0.01" value={product.price ?? ""} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, price: e.target.value === "" ? null : Number(e.target.value) } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#174d38]"/></label><button disabled={busy} onClick={() => void saveProduct(product)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#174d38] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={15}/> Salvar produto</button></article>)}</div> :
          <div className="space-y-5">
            <div className="rounded-xl border border-[#e4ddca] bg-white p-5"><h2 className="text-lg font-semibold">Biblioteca de imagens</h2><p className="mt-1 text-sm text-[#758177]">Envie imagens do computador ou celular. O arquivo original é guardado; o site ajusta apenas a exibição. As orientações são guias exclusivos do painel e nunca aparecem para os clientes.</p></div>
            <div className="grid gap-4 md:grid-cols-2">{siteImages.map(item => <article key={item.slot} className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="mb-3 overflow-hidden rounded-lg bg-[#f3f1e9]">{item.image_url ? <img src={item.image_url} alt={item.title} className="max-h-56 w-full object-cover"/> : <div className="flex h-36 items-center justify-center text-sm text-[#879188]">Imagem ainda não enviada</div>}</div><p className="text-xs font-semibold uppercase tracking-wide text-[#9b7930]">Guia de imagem · somente ADM</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-[#758177]">{item.description}</p><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#f5f2e9] p-3 text-sm"><div><span className="block text-xs text-[#879188]">Proporção</span><b>{item.recommended_ratio}</b></div><div><span className="block text-xs text-[#879188]">Tamanho sugerido</span><b>{item.recommended_dimensions}</b></div></div><label className="mt-4 block text-sm font-medium">Escolher nova imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!!uploadingSlot} onChange={e => { const file=e.target.files?.[0]; if(file) void uploadImage(file,item.slot); e.currentTarget.value=""; }} className="mt-2 block w-full text-xs"/></label>{uploadingSlot===item.slot && <p className="mt-2 text-xs text-[#9b7930]">Enviando imagem…</p>}</article>)}</div>
            <p className="text-xs text-[#879188]">Formatos aceitos: JPG, PNG, WebP e AVIF · máximo de 12 MB por arquivo.</p>
          </div>}
      </section>
    </main>
  );
}
