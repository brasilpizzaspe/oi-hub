import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ImagePlus, LogOut, Package, Plus, RefreshCw, Save, ShieldCheck, ShoppingBag, Tag, LayoutTemplate, Smartphone, Monitor, Undo2, Trash2, ChevronUp, ChevronDown, BookOpen, Pencil, CalendarDays, CheckCircle2, Clock3, CircleDashed, ClipboardCopy, Search, FileText, Image as ImageIcon, Link2, ChevronLeft } from "lucide-react";

const SUPABASE_URL = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || "https://scocgrreppdbtqctesio.supabase.co";
const SUPABASE_KEY = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) || "sb_publishable_JGN8bSFsGCxTOIubmNmHIA_J36i5Mpp";

type Product = { id: string; name: string; category: string; description: string; price: number | null; active: boolean; image_url: string | null };
type CustomerProfile = { user_id:string; email:string|null; full_name:string; phone:string|null; marketing_email:boolean; marketing_whatsapp:boolean; default_address:Record<string,string>; created_at:string; updated_at:string };
type OrderItem = { id: string; product_name: string; quantity: number; unit_price: number; line_total: number };
type Order = { id: string; order_number: number; customer_name: string; customer_phone: string; street: string; street_number: string; neighborhood: string; municipality: string | null; reference: string | null; notes: string | null; subtotal: number; delivery_fee: number | null; total: number; status: string; payment_status: string; payment_method: string; created_at: string; estimated_delivery_at: string | null; order_items: OrderItem[] };
type Session = { access_token: string; refresh_token: string; user: { id: string; email: string } };
const REMEMBERED_EMAIL_KEY = "brasil-pizzas-admin-email";
const PERSISTENT_SESSION_KEY = "brasil-pizzas-admin-session";
type SiteImage = { slot: string; title: string; description: string; recommended_ratio: string; recommended_dimensions: string; image_url: string | null; video_url: string | null };
type DeliveryZone = { id: string; municipality: string; neighborhood: string; fee: number; estimated_distance_km: number; eta_minutes: number; active: boolean };

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
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [campaignTitle,setCampaignTitle]=useState("");const [campaignMessage,setCampaignMessage]=useState("");const [campaignEmail,setCampaignEmail]=useState(true);const [campaignWhatsApp,setCampaignWhatsApp]=useState(true);const [campaignBusy,setCampaignBusy]=useState(false);
  const [siteImages, setSiteImages] = useState<SiteImage[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryZoneFilter, setDeliveryZoneFilter] = useState("all");
  const [newZoneMunicipality, setNewZoneMunicipality] = useState("Abreu e Lima");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "customers" | "campaigns" | "products" | "promotions" | "images" | "delivery" | "editor" | "development" | "manual">("orders");
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
    const [productResponse, orderResponse, imageResponse, zoneResponse, customerResponse] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category,description,price,active,image_url&order=sort_order.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=100`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/site_images?select=slot,title,description,recommended_ratio,recommended_dimensions,image_url,video_url`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/delivery_zones?select=id,municipality,neighborhood,fee,estimated_distance_km,eta_minutes,active&order=municipality.asc,neighborhood.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/customer_profiles?select=user_id,email,full_name,phone,marketing_email,marketing_whatsapp,default_address,created_at,updated_at&order=created_at.desc`, { headers }),
    ]);
    if (!productResponse.ok || !orderResponse.ok || !imageResponse.ok || !zoneResponse.ok || !customerResponse.ok) throw new Error("Não foi possível carregar os dados da loja. Verifique sua autorização.");
    setProducts(await productResponse.json());
    setOrders(await orderResponse.json());
    setSiteImages(await imageResponse.json());
    setDeliveryZones((await zoneResponse.json()).map((zone: DeliveryZone) => ({ ...zone, fee: Number(zone.fee) })));
    setCustomers(await customerResponse.json());
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


  async function saveDeliveryZone(zone: DeliveryZone) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    const name = zone.neighborhood.trim(), municipality=zone.municipality.trim(), fee = Number(zone.fee);
    if (!name || !municipality || name.length > 100 || !Number.isFinite(fee) || fee < 0) { setError("Informe um bairro válido e uma taxa igual ou maior que zero."); setNotice(""); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_zones?id=eq.${encodeURIComponent(zone.id)}`, { method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ municipality: zone.municipality, neighborhood: name, fee: Number(fee.toFixed(2)), estimated_distance_km: Number(zone.estimated_distance_km.toFixed(1)), eta_minutes: Math.round(zone.eta_minutes), updated_at: new Date().toISOString() }) });
      if (!response.ok) throw new Error("Não foi possível salvar. Confira se o nome do bairro não está duplicado.");
      setDeliveryZones(old => old.map(item => item.id === zone.id ? { ...zone, municipality, neighborhood: name, fee: Number(fee.toFixed(2)) } : item)); setNotice(`${name}: taxa atualizada.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar bairro."); }
    finally { setBusy(false); }
  }
  async function addDeliveryZone() {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    const name = newZoneName.trim(), fee = Number(newZoneFee);
    if (!name || name.length > 100 || !Number.isFinite(fee) || fee < 0) { setError("Preencha o nome do bairro e uma taxa válida."); setNotice(""); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_zones`, { method: "POST", headers: { ...apiHeaders, Prefer: "return=representation" }, body: JSON.stringify({ municipality: newZoneMunicipality, neighborhood: name, fee: Number(fee.toFixed(2)), estimated_distance_km: 0, eta_minutes: 30, active: false }) });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error("Não foi possível cadastrar. Talvez este bairro já esteja cadastrado.");
      setDeliveryZones(old => [...old, { ...payload[0], fee: Number(payload[0].fee) }].sort((a,b)=>a.municipality.localeCompare(b.municipality,"pt-BR")||a.neighborhood.localeCompare(b.neighborhood,"pt-BR"))); setNewZoneName(""); setNewZoneFee("0"); setNotice(`${name} (${newZoneMunicipality}) cadastrado. Ative somente depois de definir a taxa.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar bairro."); }
    finally { setBusy(false); }
  }
  async function toggleDeliveryZone(zone: DeliveryZone) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const active = !zone.active;
      const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_zones?id=eq.${encodeURIComponent(zone.id)}`, { method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ active, updated_at: new Date().toISOString() }) });
      if (!response.ok) throw new Error("Não foi possível alterar disponibilidade.");
      setDeliveryZones(old=>old.map(item=>item.id===zone.id?{...item,active}:item)); setNotice(active?`${zone.neighborhood} ativado.`:`${zone.neighborhood} desativado; novos pedidos para este bairro serão bloqueados.`);
    } catch(e) { setError(e instanceof Error?e.message:"Falha ao atualizar bairro."); }
    finally { setBusy(false); }
  }
  async function setCityDeliveryZonesActive(city: string, active: boolean) {
    if (!session || !apiHeaders || !SUPABASE_URL || !city) return;
    const cityZones = deliveryZones.filter(zone => zone.municipality === city);
    if (cityZones.length === 0) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_zones?municipality=eq.${encodeURIComponent(city)}`, {
        method: "PATCH",
        headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ active, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(active ? "Não foi possível ativar todos os bairros desta cidade." : "Não foi possível desativar todos os bairros desta cidade.");
      setDeliveryZones(old => old.map(zone => zone.municipality === city ? { ...zone, active } : zone));
      setNotice(active ? `Todos os ${cityZones.length} bairros de ${city} foram ativados.` : `Todos os ${cityZones.length} bairros de ${city} foram desativados.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar bairros da cidade."); }
    finally { setBusy(false); }
  }
  async function deleteDeliveryZone(zone: DeliveryZone) {
    if (!session || !apiHeaders || !SUPABASE_URL || !window.confirm(`Excluir ${zone.neighborhood} da lista de entrega?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_zones?id=eq.${encodeURIComponent(zone.id)}`, { method: "DELETE", headers: apiHeaders });
      if (!response.ok) throw new Error("Não foi possível excluir o bairro.");
      setDeliveryZones(old=>old.filter(item=>item.id!==zone.id)); setNotice(`${zone.neighborhood} removido.`);
    } catch(e) { setError(e instanceof Error?e.message:"Falha ao excluir bairro."); }
    finally { setBusy(false); }
  }

  async function saveProduct(product: Product) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    if (!product.name.trim() || product.name.trim().length > 100 || product.description.length > 300) {
      setError("Confira o nome e a descrição do produto. O nome é obrigatório (até 100 caracteres) e a descrição aceita até 300.");
      setNotice("");
      return;
    }
    if (!(["Salgadas", "Doces", "Bebidas", "Promoções"] as string[]).includes(product.category)) {
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


  async function createProduct(category: string) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const draft = { id: crypto.randomUUID(), name: category === "Promoções" ? "Nova promoção" : "Novo sabor", category, description: "", price: null, active: false, image_url: "", sort_order: products.length + 1 };
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, { method: "POST", headers: { ...apiHeaders, Prefer: "return=representation" }, body: JSON.stringify(draft) });
      if (!response.ok) throw new Error((await response.text()) || "Não foi possível cadastrar o produto.");
      const rows = await response.json();
      const created = rows[0] as Product;
      setProducts(old => [...old, { ...created, price: created.price === null ? null : Number(created.price) }]);
      setNotice(category === "Promoções" ? "Promoção criada como rascunho. Edite os dados e ative quando estiver pronta." : "Novo sabor criado como rascunho. Edite os dados e ative quando estiver pronto.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar produto."); }
    finally { setBusy(false); }
  }

  async function toggleProductActive(product: Product) {
    if (!session || !apiHeaders || !SUPABASE_URL) return;
    const active = !product.active;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ active, updated_at: new Date().toISOString() }) });
      if (!response.ok) throw new Error("Não foi possível alterar a publicação deste item.");
      setProducts(old => old.map(item => item.id === product.id ? { ...item, active } : item));
      setNotice(active ? `${product.name} publicado no cardápio.` : `${product.name} ocultado do cardápio.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao alterar publicação."); }
    finally { setBusy(false); }
  }

  async function uploadImage(file: File, slot: string, product?: Product) {
    if (!session || !SUPABASE_URL || !SUPABASE_KEY) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(file.type)) { setError("Use uma imagem JPG, PNG, WebP ou AVIF."); return; }
    if (file.size > (slot === "about-seal-logo" || slot === "hero-flame-icon" || slot.startsWith("account-avatar-") ? 2 * 1024 * 1024 : 12 * 1024 * 1024)) { setError(slot === "about-seal-logo" || slot === "hero-flame-icon" || slot.startsWith("account-avatar-") ? "A logo, ícone ou avatar deve ter no máximo 2 MB." : "A imagem deve ter no máximo 12 MB."); return; }
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


  async function removeSiteImage(item: SiteImage) {
    if (!session || !apiHeaders || !SUPABASE_URL || !item.image_url || item.slot !== "hero-flame-icon") return;
    if (!window.confirm("Remover a imagem personalizada do ícone de fogo? O Hero voltará a usar o ícone original.")) return;
    setUploadingSlot(item.slot); setError(""); setNotice("");
    try {
      const saved = await fetch(`${SUPABASE_URL}/rest/v1/site_images?slot=eq.${encodeURIComponent(item.slot)}`, {
        method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ image_url: null, updated_at: new Date().toISOString() }),
      });
      if (!saved.ok) throw new Error("Não foi possível remover a referência da imagem no banco de dados.");
      setSiteImages(old => old.map(image => image.slot === item.slot ? { ...image, image_url: null } : image));
      const marker = "/storage/v1/object/public/store-images/";
      const path = item.image_url.includes(marker) ? decodeURIComponent((item.image_url.split(marker)[1]??"").split("?")[0]??"") : null;
      if (path) {
        const removed = await fetch(`${SUPABASE_URL}/storage/v1/object/store-images/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers: apiHeaders });
        if (!removed.ok && removed.status !== 404) {
          setNotice("Imagem desvinculada do site. O ícone original voltou, mas o arquivo antigo não foi apagado do armazenamento.");
          return;
        }
      }
      setNotice("Imagem personalizada removida. O ícone de fogo original voltou ao Hero.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao remover imagem."); }
    finally { setUploadingSlot(null); }
  }

  async function uploadVideo(file: File, slot: string) {
    if (!session || !SUPABASE_URL || !SUPABASE_KEY) return;
    if (file.type !== "video/mp4") { setError("Envie um vídeo no formato MP4 (H.264 recomendado)."); return; }
    if (file.size > 50 * 1024 * 1024) { setError("O vídeo deve ter no máximo 50 MB."); return; }
    setUploadingSlot("video-" + slot); setError(""); setNotice("");
    try {
      const path = "site-videos/" + crypto.randomUUID() + ".mp4";
      const upload = await fetch(SUPABASE_URL + "/storage/v1/object/store-images/" + path, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + session.access_token, "Content-Type": "video/mp4", "x-upsert": "false" },
        body: file,
      });
      if (!upload.ok) throw new Error("Não foi possível enviar o vídeo. Confira o limite do Storage e tente novamente.");
      const publicUrl = SUPABASE_URL + "/storage/v1/object/public/store-images/" + path;
      const saved = await fetch(SUPABASE_URL + "/rest/v1/site_images?slot=eq." + encodeURIComponent(slot), {
        method: "PATCH", headers: { ...apiHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ video_url: publicUrl, updated_at: new Date().toISOString() }),
      });
      if (!saved.ok) throw new Error("Vídeo enviado, mas não foi possível vinculá-lo à seção do site.");
      setSiteImages(old => old.map(item => item.slot === slot ? { ...item, video_url: publicUrl } : item));
      setNotice("Vídeo do Hero atualizado no site.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar vídeo."); }
    finally { setUploadingSlot(null); }
  }

  async function sendCampaign() { if(!session||!SUPABASE_URL)return;const title=campaignTitle.trim(),message=campaignMessage.trim();if(!title||!message||(!campaignEmail&&!campaignWhatsApp)){setError("Preencha o título, mensagem e selecione pelo menos um canal.");return;}setCampaignBusy(true);setError("");setNotice("");try{const response=await fetch(SUPABASE_URL+"/functions/v1/customer-campaigns",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({title,message,email:campaignEmail,whatsapp:campaignWhatsApp})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Não foi possível criar a campanha.");setNotice("Campanha adicionada à fila: "+payload.queued+" mensagens ("+payload.email+" e-mail, "+payload.whatsapp+" WhatsApp).");setCampaignTitle("");setCampaignMessage("");}catch(e){setError(e instanceof Error?e.message:"Erro ao criar campanha.");}finally{setCampaignBusy(false);}}
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
    const refreshTimer = window.setInterval(async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.access_token || !payload.refresh_token) throw new Error("Sessão expirada");
        const renewed: Session = { access_token: payload.access_token, refresh_token: payload.refresh_token, user: { id: payload.user.id, email: payload.user.email } };
        setSession(renewed);
        if (window.localStorage.getItem(PERSISTENT_SESSION_KEY)) window.localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(renewed));
        await loadDashboard(renewed);
      } catch {
        setSession(null);
        window.localStorage.removeItem(PERSISTENT_SESSION_KEY);
        setKeepConnected(false);
        setError("Sua sessão expirou. Entre novamente.");
      }
    }, 50 * 60 * 1000);
    const pollTimer = window.setInterval(() => { void loadDashboard(session).catch(() => undefined); }, 30000);
    return () => { window.clearInterval(refreshTimer); window.clearInterval(pollTimer); };
  }, [session]);

  if (resetMode) return (
    <main className="min-h-screen bg-[#f7f1e8] px-4 py-12 text-[#282321]"><div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center"><div className="mb-8 text-center"><p className="text-xs font-bold tracking-[.28em] text-[#c92822]">BRASIL PIZZAS · ADMINISTRAÇÃO</p><h1 className="mt-3 text-3xl font-semibold">Criar nova senha</h1><p className="mt-2 text-sm text-[#64746a]">Escolha uma senha nova para acessar a gestão.</p></div><form onSubmit={saveNewPassword} className="rounded-2xl border border-[#e4ddca] bg-white p-7 shadow-xl"><label className="mb-4 block text-sm font-medium">Nova senha<input autoComplete="new-password" type="password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" /></label><label className="mb-5 block text-sm font-medium">Confirme a nova senha<input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" /></label>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#c92822] px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Salvando..." : "Salvar nova senha"}</button></form></div></main>
  );

  if (!session) return (
    <main className="min-h-screen bg-[#f7f1e8] px-4 py-12 text-[#282321]">
      <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c92822] text-white shadow-lg shadow-red-900/20"><ShieldCheck size={29} /></div>
          <p className="text-xs font-bold tracking-[.28em] text-[#c92822]">BRASIL PIZZAS · ADMINISTRAÇÃO</p>
          <h1 className="mt-3 text-3xl font-semibold">Acesso reservado</h1>
          <p className="mt-2 text-sm text-[#64746a]">Entre com as credenciais autorizadas da loja.</p>
        </div>
        {resetMode ? <form onSubmit={requestPasswordReset} className="rounded-2xl border border-[#eadbc8] bg-white p-7 shadow-2xl shadow-[#5b2c20]/10"><label className="mb-4 block text-sm font-medium">E-mail cadastrado<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3" placeholder="seu@email.com" /></label>{error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mb-4 rounded-lg bg-[#e4eee6] p-3 text-sm text-[#302b28]">{notice}</p>}<button disabled={busy || resetSent} className="w-full rounded-xl bg-[#c92822] px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Enviando..." : resetSent ? "Link solicitado" : "Enviar link de redefinição"}</button><button type="button" onClick={() => { setResetMode(false); setResetSent(false); setError(""); setNotice(""); }} className="mt-4 w-full text-sm text-[#64746a]">Voltar ao login</button></form> : <form onSubmit={signIn} className="rounded-2xl border border-[#eadbc8] bg-white p-7 shadow-2xl shadow-[#5b2c20]/10">
          <label className="mb-4 block text-sm font-medium">E-mail
            <input autoComplete="username" list="admin-email-suggestions" type="email" required value={email} onChange={e => setEmail(e.target.value)} onBlur={e => { if (e.target.value.trim()) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, e.target.value.trim()); }} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3 outline-none focus:border-[#c92822]" placeholder="brasilpizzaspe@gmail.com" /><datalist id="admin-email-suggestions"><option value="brasilpizzaspe@gmail.com" /></datalist>
          </label>
          <label className="mb-5 block text-sm font-medium">Senha
            <input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#d9dfd8] px-3 py-3 outline-none focus:border-[#c92822]" placeholder="Sua senha" />
          </label>
          <label className="mb-4 flex items-center gap-2 text-sm text-[#64746a]"><input type="checkbox" checked={keepConnected} onChange={e => { setKeepConnected(e.target.checked); if (!e.target.checked) window.localStorage.removeItem(PERSISTENT_SESSION_KEY); }} className="h-4 w-4 accent-[#302b28]" /> Manter conectado neste dispositivo</label>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#c92822] px-4 py-3 font-bold text-white transition hover:bg-[#a91f1a] disabled:opacity-60">{busy ? "Verificando..." : "Entrar"}</button>
          <button type="button" onClick={() => { setResetMode(true); setError(""); setNotice(""); }} className="mb-3 w-full text-sm font-medium text-[#9b7930] hover:underline">Esqueci minha senha</button>
          <p className="mt-5 text-center text-xs text-[#879188]">Área privada. Acesso monitorado e restrito.</p>
        </form>}
        <a href="/" className="mt-6 text-center text-sm text-[#64746a] hover:text-[#302b28]">Voltar à página inicial</a>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f1e8] text-[#242321]">
      <header className="border-b border-[#332b29] bg-[#211d1b] text-white shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#c92822] text-white shadow-md shadow-red-950/30"><ShieldCheck size={23}/></div><div><p className="text-[10px] font-bold tracking-[.25em] text-[#e6b94e]">BRASIL PIZZAS · ADM</p><h1 className="text-xl font-bold tracking-tight">Central de gestão</h1></div></div>
          <div className="flex items-center gap-3"><button onClick={() => void refresh()} disabled={busy} className="rounded-lg border border-white/15 bg-white/5 p-2.5 text-white transition hover:bg-white/10" aria-label="Atualizar"><RefreshCw size={17}/></button><button onClick={() => { setSession(null); setProducts([]); setOrders([]); setCustomers([]); setSiteImages([]); window.localStorage.removeItem(PERSISTENT_SESSION_KEY); setKeepConnected(false); setNotice("Você saiu da área administrativa."); setError(""); }} className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"><LogOut size={16}/> Sair</button></div>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadbc8] bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5e6d4] text-[#9a4a2b]"><ShieldCheck size={17}/></div><div><p className="text-xs text-[#8a8178]">Sessão administrativa</p><p className="text-sm font-semibold text-[#302b28]">{session.user.email}</p></div></div><span className="rounded-full bg-[#e8f1e8] px-3 py-1.5 text-xs font-semibold text-[#356347]">● Acesso verificado</span></div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg bg-[#e4eee6] p-3 text-sm text-[#302b28]">{notice}</p>}
        <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-[#eadbc8] bg-white p-2 shadow-sm"><button onClick={() => setTab("orders")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "orders" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}><ShoppingBag size={16}/> Pedidos ({orders.length})</button><button onClick={() => setTab("customers")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "customers" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}>Clientes ({customers.length})</button><button onClick={() => setTab("campaigns")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "campaigns" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}>Campanhas</button><button onClick={() => setTab("products")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "products" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}><Package size={16}/> Cardápio ({products.filter(p => p.category !== "Promoções").length})</button><button onClick={() => setTab("promotions")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "promotions" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}><Tag size={16}/> Promoções ({products.filter(p => p.category === "Promoções").length})</button><button onClick={() => setTab("images")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "images" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}>Imagens do site</button><button onClick={() => setTab("delivery")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "delivery" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}>Entrega</button><button onClick={() => setTab("editor")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "editor" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}><LayoutTemplate size={16}/> Editor visual</button><button onClick={() => setTab("manual")} className={`flex items-center gap-2 rounded-xl whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${tab === "manual" ? "bg-[#c92822] text-white shadow-sm" : "text-[#746b64] hover:bg-[#f8eee5]"}`}><FileText size={16}/> Manual do projeto</button></div>
        {tab === "campaigns" ? <section className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="mb-4"><h2 className="text-xl font-semibold">Nova campanha</h2><p className="text-sm text-[#758177]">A campanha será enviada somente aos clientes que autorizaram receber ofertas no canal selecionado.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={campaignEmail} onChange={e=>setCampaignEmail(e.target.checked)}/> E-mail promocional</label><label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={campaignWhatsApp} onChange={e=>setCampaignWhatsApp(e.target.checked)}/> WhatsApp promocional</label></div><label className="mt-4 block text-sm font-medium">Título<input value={campaignTitle} onChange={e=>setCampaignTitle(e.target.value)} maxLength={120} placeholder="Ex.: Oferta de fim de semana" className="mt-1 w-full rounded-lg border px-3 py-2"/></label><label className="mt-3 block text-sm font-medium">Mensagem<textarea value={campaignMessage} onChange={e=>setCampaignMessage(e.target.value)} maxLength={1200} rows={5} placeholder="Escreva a oferta e as condições..." className="mt-1 w-full rounded-lg border px-3 py-2"/></label><button disabled={campaignBusy||!campaignTitle.trim()||!campaignMessage.trim()||(!campaignEmail&&!campaignWhatsApp)} onClick={()=>void sendCampaign()} className="mt-4 rounded-lg bg-[#c92822] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{campaignBusy?"Enfileirando...":"Enviar campanha para clientes autorizados"}</button><p className="mt-3 text-xs text-[#758177]">WhatsApp só envia após o template promocional ser aprovado pela Meta e o serviço estar configurado. E-mail requer o provedor configurado.</p></section> : tab === "customers" ? <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#758177]">Clientes cadastrados</p><strong className="text-2xl">{customers.length}</strong></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#758177]">Opt-in e-mail</p><strong className="text-2xl">{customers.filter(c=>c.marketing_email).length}</strong></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-[#758177]">Opt-in WhatsApp</p><strong className="text-2xl">{customers.filter(c=>c.marketing_whatsapp).length}</strong></div></div><div className="rounded-xl border border-[#e4ddca] bg-white p-4"><h2 className="font-semibold">Base de clientes</h2><p className="mb-3 text-sm text-[#758177]">Contas, telefone/endereço usados no checkout e autorização de ofertas.</p>{customers.length===0?<p className="py-5 text-center text-sm text-[#758177]">Nenhum cliente cadastrado ainda.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-[#758177]"><th className="p-2">Cliente</th><th className="p-2">WhatsApp</th><th className="p-2">Consentimento</th><th className="p-2">Endereço</th><th className="p-2">Cadastro</th></tr></thead><tbody>{customers.map(c=><tr key={c.user_id} className="border-b last:border-0"><td className="p-2"><strong>{c.full_name||"Sem nome"}</strong><div className="text-xs text-[#758177]">{c.email||"Sem e-mail"}</div></td><td className="p-2">{c.phone||"—"}</td><td className="p-2">E-mail: {c.marketing_email?"Sim":"Não"}<br/>WhatsApp: {c.marketing_whatsapp?"Sim":"Não"}</td><td className="p-2">{c.default_address?.["street"] ? c.default_address["street"]+", "+(c.default_address["number"]||"")+" · "+(c.default_address["neighborhood"]||"")+", "+(c.default_address["municipality"]||"") : "—"}</td><td className="p-2">{c.created_at?new Date(c.created_at).toLocaleDateString("pt-BR"):"—"}</td></tr>)}</tbody></table></div>}</div></section> : tab === "orders" ? <div className="space-y-4">{orders.length === 0 ? <div className="rounded-xl border border-[#e4ddca] bg-white p-8 text-center text-sm text-[#758177]">Nenhum pedido registrado ainda.</div> : orders.map(order => <article key={order.id} className="rounded-xl border border-[#e4ddca] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wider text-[#9b7930]">PEDIDO #{order.order_number}</p><h2 className="mt-1 text-lg font-semibold">{order.customer_name}</h2><p className="text-sm text-[#758177]">{order.customer_phone} · {new Date(order.created_at).toLocaleString("pt-BR")}</p></div><select aria-label={`Status do pedido ${order.order_number}`} value={order.status} disabled={busy} onChange={e => void updateOrder(order, e.target.value)} className="rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-sm">{statuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-4 grid gap-4 border-t border-[#edf0eb] pt-4 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#879188]">Entrega</p><p className="mt-1 text-sm">{order.street}, {order.street_number} · {order.neighborhood}{order.municipality?`, ${order.municipality}`:""}</p>{order.reference && <p className="text-sm text-[#758177]">Ref.: {order.reference}</p>}<label className="mt-3 block text-xs font-medium text-[#758177]">Previsão de entrega<input type="datetime-local" value={toLocalDateTime(order.estimated_delivery_at)} onChange={e => setOrders(old => old.map(item => item.id === order.id ? { ...item, estimated_delivery_at: e.target.value ? new Date(e.target.value).toISOString() : null } : item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><button disabled={busy} onClick={() => void saveEstimate(order)} className="mt-2 rounded-lg border border-[#d9dfd8] px-3 py-2 text-xs font-semibold disabled:opacity-60">Salvar previsão</button></div><div><p className="text-xs font-semibold uppercase tracking-wide text-[#879188]">Pagamento</p><p className="mt-1 text-sm">{order.payment_method} · {order.payment_status === "approved" ? "Aprovado" : order.payment_status === "pending" ? "Pendente" : order.payment_status}</p><div className="mt-2 space-y-1 text-sm"><p>Subtotal dos itens: {money(Number(order.subtotal))}</p><p>Taxa de entrega: {order.delivery_fee === null ? "A confirmar" : money(Number(order.delivery_fee))}</p><p className="pt-1 font-semibold">{order.delivery_fee === null ? "Subtotal provisório" : "Total do pedido"}: {money(Number(order.total))}</p></div></div></div><div className="mt-3 border-t border-[#edf0eb] pt-3 text-sm">{(order.order_items || []).map(item => <p key={item.id}>{item.quantity}x {item.product_name} — {money(Number(item.line_total))}</p>)}{order.notes && <p className="mt-2 text-[#758177]">Obs.: {order.notes}</p>}</div></article>)}</div> : (tab === "products" || tab === "promotions") ? <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{tab === "promotions" ? "Promoções" : "Cardápio"}</h2><p className="text-sm text-[#758177]">{tab === "promotions" ? "Cadastre ofertas e combos para aparecerem na aba Promoções da landing page." : "Adicione sabores, bebidas e edite os produtos que aparecem na página do cliente."}</p></div><button disabled={busy} onClick={() => void createProduct(tab === "promotions" ? "Promoções" : "Salgadas")} className="flex items-center gap-2 rounded-lg bg-[#c92822] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16}/> {tab === "promotions" ? "Nova promoção" : "Adicionar sabor"}</button></div><div className="grid gap-3 md:grid-cols-2">{products.filter(product => tab === "promotions" ? product.category === "Promoções" : product.category !== "Promoções").map(product => <article key={product.id} className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="mb-3 overflow-hidden rounded-lg bg-[#f3f1e9]">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-40 w-full object-cover"/> : <div className="flex h-32 items-center justify-center text-xs text-[#879188]">Sem imagem cadastrada</div>}</div><p className="mb-2 text-xs text-[#879188]">Foto de produto · proporção 1:1 · recomendado 1000 × 1000 px</p><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-xs font-semibold text-[#302b28] hover:bg-[#f4f7f4]"><ImagePlus size={15}/>{uploadingSlot === `product-${product.id}` ? "Enviando foto..." : product.image_url ? "Trocar foto" : "Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!!uploadingSlot} onChange={e => { const file=e.target.files?.[0]; if(file) void uploadImage(file, `product-${product.id}`, product); e.currentTarget.value=""; }} className="sr-only"/></label><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1 space-y-3"><label className="block text-xs font-medium text-[#758177]">Nome do produto<input maxLength={100} value={product.name} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, name: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><label className="block text-xs font-medium text-[#758177]">Categoria<select value={product.category} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, category: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-sm text-[#302b28]"><option>Salgadas</option><option>Doces</option><option>Bebidas</option><option>Promoções</option></select></label><label className="block text-xs font-medium text-[#758177]">Descrição<textarea maxLength={300} value={product.description} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, description: e.target.value } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label></div><button type="button" role="switch" aria-checked={product.active} aria-label={product.active ? "Desativar produto na landing page" : "Ativar produto na landing page"} disabled={busy} onClick={() => void toggleProductActive(product)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${product.active ? "bg-[#c92822]" : "bg-[#cbd5ce]"}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${product.active ? "translate-x-6" : "translate-x-1"}`}/></button></div><label className="mt-4 block text-xs font-medium text-[#758177]">Preço (R$)<input type="number" min="0" step="0.01" value={product.price ?? ""} onChange={e => setProducts(old => old.map(p => p.id === product.id ? { ...p, price: e.target.value === "" ? null : Number(e.target.value) } : p))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><button disabled={busy} onClick={() => void saveProduct(product)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c92822] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={15}/> Salvar produto</button></article>)}</div>{products.filter(product => tab === "promotions" ? product.category === "Promoções" : product.category !== "Promoções").length === 0 && <div className="mt-3 rounded-xl border border-dashed border-[#d9dfd8] bg-white p-8 text-center text-sm text-[#758177]">{tab === "promotions" ? "Nenhuma promoção cadastrada. Clique em Nova promoção para começar." : "Nenhum produto cadastrado nesta seção."}</div>}</div> : tab === "images" ? <div className="space-y-5">
            <div className="rounded-xl border border-[#e4ddca] bg-white p-5"><h2 className="text-lg font-semibold">Biblioteca de mídia</h2><p className="mt-1 text-sm text-[#758177]">Envie imagens para banners, produtos, vídeos e personalize os 6 avatares de pizza usados em Minha Conta. Os avatares devem ser quadrados, PNG transparente, 512 × 512 px e até 2 MB. O arquivo original é guardado; o site ajusta apenas a exibição.</p></div>
            <div className="grid gap-4 md:grid-cols-2">{siteImages.map(item => <article key={item.slot} className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="mb-3 overflow-hidden rounded-lg bg-[#f3f1e9]">{item.video_url ? <video src={item.video_url} poster={item.image_url || undefined} muted loop playsInline controls className="max-h-56 w-full object-cover"/> : item.image_url ? <img src={item.image_url} alt={`Imagem atualmente utilizada: ${item.title}`} className={`max-h-56 w-full ${item.slot === "about-seal-logo" || item.slot === "hero-flame-icon" || item.slot.startsWith("account-avatar-") ? "object-contain p-4" : "object-cover"}`}/> : <div className="flex h-36 items-center justify-center text-sm text-[#879188]">Imagem ainda não enviada</div>}{item.image_url && <p className="border-t border-[#e4ddca] bg-white px-3 py-2 text-xs text-[#45634f]">✓ Imagem atual utilizada no site</p>}</div><p className="text-xs font-semibold uppercase tracking-wide text-[#9b7930]">Guia de imagem · somente ADM</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-[#758177]">{item.description}</p><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#f5f2e9] p-3 text-sm"><div><span className="block text-xs text-[#879188]">Proporção</span><b>{item.recommended_ratio}</b></div><div><span className="block text-xs text-[#879188]">Tamanho sugerido</span><b>{item.recommended_dimensions}</b></div></div><label className="mt-4 block text-sm font-medium">Escolher nova imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!!uploadingSlot} onChange={e => { const file=e.target.files?.[0]; if(file) void uploadImage(file,item.slot); e.currentTarget.value=""; }} className="mt-2 block w-full text-xs"/></label>{item.slot === "hero-flame-icon" && item.image_url && <button type="button" disabled={!!uploadingSlot} onClick={() => void removeSiteImage(item)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash2 size={15}/>{uploadingSlot === item.slot ? "Removendo..." : "Remover imagem e restaurar fogo original"}</button>}{item.slot === "hero" && <label className="mt-3 block text-sm font-medium">Enviar vídeo do Hero (MP4)<input type="file" accept="video/mp4,.mp4" disabled={!!uploadingSlot} onChange={e => { const file=e.target.files?.[0]; if(file) void uploadVideo(file,item.slot); e.currentTarget.value=""; }} className="mt-2 block w-full text-xs"/></label>}{uploadingSlot===item.slot && <p className="mt-2 text-xs text-[#9b7930]">Enviando imagem…</p>}{uploadingSlot==="video-" + item.slot && <p className="mt-2 text-xs text-[#9b7930]">Enviando vídeo…</p>}{item.video_url && <p className="mt-2 text-xs text-[#302b28]">Vídeo cadastrado. O Hero prioriza o vídeo e mantém a imagem como poster.</p>}</article>)}</div>
            <p className="text-xs text-[#879188]">Imagens: JPG, PNG, WebP e AVIF (até 12 MB). Vídeo do Hero: MP4 (até 50 MB).</p>
          </div>  : tab === "delivery" ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"><div className="space-y-4"><div className="rounded-xl border border-[#e4ddca] bg-white p-5"><h2 className="text-xl font-semibold">Bairros e taxas de entrega</h2><p className="mt-2 text-sm text-[#758177]">A taxa definida aqui será calculada nos pedidos. Bairros desativados não poderão concluir pedidos.</p>{deliveryZones.length===0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Os valores e tempos são estimativas iniciais por distância aproximada. Ajuste após conferir rotas reais. Bairros desativados não poderão concluir pedidos.</p>}</div>{deliveryZones.length>0&&<div className="rounded-xl border border-[#e4ddca] bg-white p-3"><label className="block text-xs font-medium text-[#758177]">Selecionar cidade<select value={deliveryZoneFilter} onChange={e=>setDeliveryZoneFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d9dfd8] bg-white px-3 py-2 text-sm text-[#302b28]"><option value="all">Todas as cidades ({deliveryZones.length})</option>{Array.from(new Set(deliveryZones.map(zone=>zone.municipality))).sort().map(city=><option key={city} value={city}>{city} ({deliveryZones.filter(zone=>zone.municipality===city).length})</option>)}</select></label>{deliveryZoneFilter!=="all"&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void setCityDeliveryZonesActive(deliveryZoneFilter,true)} className="rounded-lg bg-[#c92822] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Ativar todos os bairros</button><button disabled={busy} onClick={()=>void setCityDeliveryZonesActive(deliveryZoneFilter,false)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Desativar todos os bairros</button><span className="self-center text-xs text-[#758177]">Somente {deliveryZoneFilter}</span></div>}</div>}{deliveryZones.length===0?<div className="rounded-xl border border-[#e4ddca] bg-white p-8 text-center text-sm text-[#758177]">Nenhum bairro configurado.</div>:deliveryZones.filter(zone=>deliveryZoneFilter==="all"||zone.municipality===deliveryZoneFilter).map(zone=><article key={zone.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e4ddca] bg-white p-4"><div className="w-full text-xs font-semibold text-[#9b7930]">{zone.municipality}</div><div className="w-28 text-xs font-medium text-[#758177]">Distância est. (km)<input type="number" min="0" step="0.1" value={zone.estimated_distance_km} onChange={e=>setDeliveryZones(old=>old.map(item=>item.id===zone.id?{...item,estimated_distance_km:Number(e.target.value)}:item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></div><div className="w-28 text-xs font-medium text-[#758177]">Prazo (min)<input type="number" min="15" step="5" value={zone.eta_minutes} onChange={e=>setDeliveryZones(old=>old.map(item=>item.id===zone.id?{...item,eta_minutes:Number(e.target.value)}:item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></div><label className="min-w-[180px] flex-1 text-xs font-medium text-[#758177]">Bairro<input maxLength={100} value={zone.neighborhood} onChange={e=>setDeliveryZones(old=>old.map(item=>item.id===zone.id?{...item,neighborhood:e.target.value}:item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><label className="w-32 text-xs font-medium text-[#758177]">Taxa (R$)<input type="number" min="0" step="0.01" value={zone.fee} onChange={e=>setDeliveryZones(old=>old.map(item=>item.id===zone.id?{...item,fee:Number(e.target.value)}:item))} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><button disabled={busy} onClick={()=>void saveDeliveryZone(zone)} className="rounded-lg bg-[#c92822] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button><button disabled={busy} onClick={()=>void toggleDeliveryZone(zone)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${zone.active?"bg-[#e4eee6] text-[#302b28]":"bg-gray-100 text-gray-600"}`}>{zone.active?"Ativo":"Inativo"}</button><button disabled={busy} onClick={()=>void deleteDeliveryZone(zone)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Excluir</button></article>)}</div><aside className="rounded-xl border border-[#e4ddca] bg-white p-5"><h3 className="font-semibold">Adicionar bairro</h3><div className="mt-3 space-y-3"><label className="block text-xs font-medium text-[#758177]">Cidade<select value={newZoneMunicipality} onChange={e=>setNewZoneMunicipality(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"><option>Abreu e Lima</option><option>Paulista</option><option>Igarassu</option></select></label><label className="block text-xs font-medium text-[#758177]">Nome do bairro<input maxLength={100} value={newZoneName} onChange={e=>setNewZoneName(e.target.value)} placeholder="Ex.: Boa Viagem" className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><label className="block text-xs font-medium text-[#758177]">Taxa (R$)<input type="number" min="0" step="0.01" value={newZoneFee} onChange={e=>setNewZoneFee(e.target.value)} className="mt-1 w-full rounded-lg border border-[#d9dfd8] px-3 py-2 text-sm text-[#302b28]"/></label><button disabled={busy||!newZoneName.trim()} onClick={()=>void addDeliveryZone()} className="w-full rounded-lg bg-[#c92822] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} className="mr-1 inline"/>Cadastrar bairro</button><p className="text-xs text-[#758177]">Cadastre apenas áreas que realmente atende. Evite duplicar nomes de bairros.</p></div></aside></div> : tab === "editor" ? <VisualEditor />  : <ProjectManual session={session} />}
      </section>
    </main>
  );
}



type ManualLink={label:string;url:string};
type ManualEntry={id:string;title:string;category:string;summary:string;content:string;prompt:string;links:ManualLink[];image_urls:string[];sort_order:number;created_at:string;updated_at:string};
function ProjectManual({session}:{session:Session}){
 const [entries,setEntries]=useState<ManualEntry[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [query,setQuery]=useState(""),[categoryFilter,setCategoryFilter]=useState("Todas"),[selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState(false);
 const [title,setTitle]=useState(""),[category,setCategory]=useState("Fundamentos e planejamento"),[summary,setSummary]=useState(""),[content,setContent]=useState(""),[prompt,setPrompt]=useState(""),[linksText,setLinksText]=useState(""),[imagesText,setImagesText]=useState("");
 const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`};
 async function load(){setLoading(true);setError("");try{const r=await fetch(`${SUPABASE_URL}/rest/v1/site_project_manual?select=*&order=sort_order.asc,title.asc`,{headers});if(!r.ok)throw new Error("Falha ao carregar o manual. Confira sua conexão/permissões.");setEntries(await r.json());}catch(e){setError(e instanceof Error?e.message:"Erro ao carregar manual.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[session.access_token]);
 const categories=["Todas",...Array.from(new Set(entries.map(x=>x.category))).sort()];
 const filtered=entries.filter(e=>(categoryFilter==="Todas"||e.category===categoryFilter)&&(`${e.title} ${e.summary} ${e.content} ${e.prompt} ${e.category}`.toLowerCase().includes(query.toLowerCase())));
 const current=entries.find(e=>e.id===selected)||null;
 function reset(){setSelected(null);setEditing(false);setTitle("");setCategory("Fundamentos e planejamento");setSummary("");setContent("");setPrompt("");setLinksText("");setImagesText("");}
 function edit(e:ManualEntry){setSelected(e.id);setEditing(true);setTitle(e.title);setCategory(e.category);setSummary(e.summary);setContent(e.content);setPrompt(e.prompt);setLinksText((e.links||[]).map(x=>x.label+" | "+x.url).join("\n"));setImagesText((e.image_urls||[]).join("\n"));}
 function newDoc(){reset();setEditing(true);}
 async function copyText(value:string,label:string){try{await navigator.clipboard.writeText(value);setNotice(label+" copiado para a área de transferência.");setError("");}catch{setError("Não foi possível copiar automaticamente. Selecione e copie o texto.");}}
 function parseLinks(raw:string){return raw.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{const [label,url]=line.split("|").map(x=>x.trim());return {label:label||url||"Link",url:url||label||""};}).filter(x=>/^https?:\/\//i.test(x.url));}
 function parseImages(raw:string){return raw.split("\n").map(x=>x.trim()).filter(x=>/^https?:\/\//i.test(x));}
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(title.trim().length<3){setError("O título precisa ter pelo menos 3 caracteres.");return;}setBusy(true);setError("");setNotice("");try{const body={title:title.trim(),category,summary:summary.trim(),content:content.trim(),prompt:prompt.trim(),links:parseLinks(linksText),image_urls:parseImages(imagesText),updated_at:new Date().toISOString()};const isEdit=!!selected;const url=isEdit?`${SUPABASE_URL}/rest/v1/site_project_manual?id=eq.${encodeURIComponent(selected!)}`:`${SUPABASE_URL}/rest/v1/site_project_manual`;const r=await fetch(url,{method:isEdit?"PATCH":"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(isEdit?body:{...body,created_by:session.user.id,sort_order:entries.length+1})});const out=await r.json().catch(()=>[]);if(!r.ok)throw new Error(out?.message||"Não foi possível salvar.");const saved=out[0];setEntries(old=>isEdit?old.map(x=>x.id===selected?saved:x):[...old,saved].sort((a,b)=>a.sort_order-b.sort_order));setSelected(saved.id);setEditing(false);setNotice(isEdit?"Documento atualizado.":"Documento adicionado ao manual.");}catch(e){setError(e instanceof Error?e.message:"Erro ao salvar.");}finally{setBusy(false);}}
 async function remove(e:ManualEntry){if(!window.confirm(`Excluir "${e.title}" do manual? Essa ação não pode ser desfeita.`))return;setBusy(true);try{const r=await fetch(`${SUPABASE_URL}/rest/v1/site_project_manual?id=eq.${encodeURIComponent(e.id)}`,{method:"DELETE",headers});if(!r.ok)throw new Error("Falha ao excluir documento.");setEntries(old=>old.filter(x=>x.id!==e.id));reset();setNotice("Documento removido.");}catch(err){setError(err instanceof Error?err.message:"Falha ao excluir.");}finally{setBusy(false);}}
 async function uploadScreenshots(files:FileList|null){if(!files?.length)return;setBusy(true);setError("");try{const uploaded:string[]=[];for(const file of Array.from(files)){if(!file.type.startsWith("image/"))continue;if(file.size>12*1024*1024)throw new Error(`A imagem ${file.name} ultrapassa 12 MB.`);const ext=file.name.split(".").pop()?.toLowerCase()||"png";const path=`manual/screenshots/${crypto.randomUUID()}. ${ext}`.replace(" ","");const r=await fetch(`${SUPABASE_URL}/storage/v1/object/store-images/${path}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type,"x-upsert":"false"},body:file});if(!r.ok)throw new Error("Upload falhou. Verifique se seu ADM tem permissão no bucket de imagens.");uploaded.push(`${SUPABASE_URL}/storage/v1/object/public/store-images/${path}`);}setImagesText(old=>[old.trim(),...uploaded].filter(Boolean).join("\n"));setNotice(uploaded.length+" imagem(ns) enviada(s); salve o documento para anexá-las.");}catch(e){setError(e instanceof Error?e.message:"Falha ao enviar imagens.");}finally{setBusy(false);}}
 const renderContent=(value:string)=><div className="whitespace-pre-wrap break-words text-sm leading-7 text-[#4d5b51]">{value}</div>;
 return <div className="space-y-4">
  <div className="rounded-xl border border-[#e4ddca] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Central de conhecimento do projeto</h2><p className="mt-1 max-w-3xl text-sm text-[#758177]">Manual para construir, configurar, reproduzir e manter esta plataforma. Inclui tutoriais passo a passo, prompts reutilizáveis, checklists, links oficiais e imagens de apoio que você pode anexar.</p></div><button onClick={newDoc} className="rounded-lg bg-[#c92822] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} className="mr-1 inline"/>Novo documento</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-[#f5f2e9] p-3 text-sm"><b>{entries.length}</b> guias/documentos</div><div className="rounded-lg bg-[#e4eee6] p-3 text-sm"><b>{entries.filter(e=>e.prompt).length}</b> prompts reutilizáveis</div><div className="rounded-lg bg-blue-50 p-3 text-sm"><b>Passo a passo</b> + anexos visuais</div></div></div>
  {(error||notice)&&<p className={error?"rounded-lg bg-red-50 p-3 text-sm text-red-700":"rounded-lg bg-[#e4eee6] p-3 text-sm text-[#302b28]"}>{error||notice}</p>}
  {editing?<form onSubmit={save} className="rounded-xl border border-[#e4ddca] bg-white p-5 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{selected?"Editar documento":"Novo documento"}</h3><button type="button" onClick={()=>{setEditing(false);if(!selected)reset();}} className="text-sm text-[#758177] underline">Cancelar</button></div><label className="block text-xs font-medium text-[#758177]">Título<input required minLength={3} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="block text-xs font-medium text-[#758177]">Categoria<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ex.: Configuração de serviços" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="block text-xs font-medium text-[#758177]">Resumo<textarea rows={2} value={summary} onChange={e=>setSummary(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="block text-xs font-medium text-[#758177]">Conteúdo / tutorial<textarea rows={14} value={content} onChange={e=>setContent(e.target.value)} placeholder="Escreva o passo a passo, requisitos, dicas, erros comuns, checklists…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="block text-xs font-medium text-[#758177]">Prompt reutilizável (opcional)<textarea rows={8} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Prompt completo para reproduzir ou executar uma tarefa…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><label className="block text-xs font-medium text-[#758177]">Links de referência (um por linha: Nome | URL)<textarea rows={3} value={linksText} onChange={e=>setLinksText(e.target.value)} placeholder="Documentação oficial | https://..." className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label><div><label className="block text-xs font-medium text-[#758177]">Imagens/screenshot de apoio — URLs (uma por linha)</label><textarea rows={3} value={imagesText} onChange={e=>setImagesText(e.target.value)} placeholder="https://.../screenshot.png" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/><label className="mt-2 block text-xs font-medium text-[#758177]">Ou enviar screenshots/imagens (até 12 MB cada)<input type="file" multiple accept="image/*" disabled={busy} onChange={e=>{void uploadScreenshots(e.target.files);e.currentTarget.value="";}} className="mt-1 block w-full text-xs"/></label><p className="mt-1 text-xs text-[#758177]">Após upload, salve o documento para guardar as imagens anexadas. Não envie capturas que mostrem senhas, tokens, Client Secrets ou dados pessoais.</p></div><button disabled={busy} type="submit" className="rounded-lg bg-[#c92822] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} className="mr-1 inline"/>{busy?"Salvando…":"Salvar documento"}</button></form>
  :<div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="rounded-xl border border-[#e4ddca] bg-white p-4"><label className="flex items-center gap-2 rounded-lg border px-3 py-2"><Search size={16} className="text-[#758177]"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar no manual…" className="min-w-0 flex-1 text-sm outline-none"/></label><label className="mt-3 block text-xs font-medium text-[#758177]">Categoria<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">{categories.map(c=><option key={c}>{c}</option>)}</select></label><div className="mt-3 max-h-[65vh] space-y-1 overflow-y-auto">{loading?<p className="p-3 text-sm">Carregando…</p>:filtered.map(e=><button key={e.id} onClick={()=>{setSelected(e.id);setEditing(false);}} className={`block w-full rounded-lg p-3 text-left ${selected===e.id?"bg-[#e4eee6] text-[#302b28]":"hover:bg-[#f5f2e9]"}`}><span className="block text-xs text-[#9b7930]">{e.category}</span><span className="mt-1 block text-sm font-semibold">{e.title}</span><span className="mt-1 block text-xs text-[#758177]">{e.summary}</span></button>)}</div></aside><section className="min-h-[350px] rounded-xl border border-[#e4ddca] bg-white p-5">{current?<div><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#9b7930]">{current.category}</p><h3 className="mt-1 text-xl font-semibold">{current.title}</h3><p className="mt-2 text-sm text-[#758177]">{current.summary}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>edit(current)} className="rounded-lg border px-3 py-2 text-sm"><Pencil size={14} className="mr-1 inline"/>Editar</button><button onClick={()=>void remove(current)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Excluir</button></div></div>{current.image_urls?.length>0&&<div className="mt-4 grid gap-3 sm:grid-cols-2">{current.image_urls.map((url,i)=><a key={url+i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border"><img src={url} alt={current.title+" — imagem de apoio"} className="max-h-80 w-full object-contain bg-[#f5f2e9]"/></a>)}</div>}<div className="mt-5">{renderContent(current.content)}</div>{current.prompt&&<div className="mt-5 rounded-xl border border-[#d8e2d9] bg-[#f5f8f5] p-4"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold">Prompt reutilizável</h4><button onClick={()=>void copyText(current.prompt,"Prompt")} className="rounded-lg bg-[#c92822] px-3 py-2 text-xs font-semibold text-white"><ClipboardCopy size={14} className="mr-1 inline"/>Copiar prompt</button></div><pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#3f5145]">{current.prompt}</pre></div>}<div className="mt-5 flex flex-wrap gap-2">{current.links?.map((link,i)=><a key={i} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium text-[#302b28]"><Link2 size={13}/>{link.label}</a>)}</div></div>:<div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-[#758177]"><BookOpen size={32}/><p className="mt-3 font-medium">Selecione um guia no índice</p><p className="mt-1 text-sm">Ou crie um novo documento para registrar um procedimento, prompt ou configuração.</p></div>}</section></div>}
  <p className="text-xs text-[#758177]">Manual privado do ADM. Registre procedimentos com links oficiais, screenshots sem dados sensíveis, prompts, testes e observações. As credenciais devem ficar fora desta documentação.</p>
 </div>;
}

function VisualEditor(){
  type Block={id:string;kind:"hero"|"text"|"banner"|"button";title:string;body:string;color:string;align:"left"|"center"|"right";visible:boolean};
  const initial:Block[]=[{id:"hero",kind:"hero",title:"O sabor que aproxima",body:"Pizza feita para compartilhar momentos.",color:"#302b28",align:"center",visible:true},{id:"promo",kind:"banner",title:"Uma oferta especial",body:"Confira nossas promoções de hoje.",color:"#d6ad48",align:"center",visible:true},{id:"about",kind:"text",title:"Feita com carinho",body:"Ingredientes selecionados e sabor que reúne pessoas.",color:"#302b28",align:"left",visible:true},{id:"cta",kind:"button",title:"Peça sua pizza",body:"",color:"#302b28",align:"center",visible:true}];
  const key="brasilpizzas:visual-editor-draft:v1";
  const [blocks,setBlocks]=useState<Block[]>(()=>{try{if(typeof window==="undefined")return initial;const saved=window.localStorage.getItem(key);return saved?JSON.parse(saved):initial}catch{return initial}});
  const [selected,setSelected]=useState("hero");const [device,setDevice]=useState<"desktop"|"mobile">("desktop");const [history,setHistory]=useState<Block[][]>([]);const current=blocks.find(b=>b.id===selected)||blocks[0];
  const commit=(next:Block[])=>{setHistory(old=>[...old.slice(-19),blocks]);setBlocks(next)};
  const update=(id:string,patch:Partial<Block>)=>commit(blocks.map(b=>b.id===id?{...b,...patch}:b));
  const move=(id:string,delta:number)=>{const index=blocks.findIndex(b=>b.id===id),target=index+delta;if(target<0||target>=blocks.length)return;const next=[...blocks];const a=next[index],c=next[target];if(!a||!c)return;next[index]=c;next[target]=a;commit(next)};
  const add=(kind:Block["kind"])=>{const id=crypto.randomUUID();commit([...blocks,{id,kind,title:kind==="text"?"Novo texto":kind==="banner"?"Novo banner":kind==="button"?"Novo botão":"Novo destaque",body:"Edite este conteúdo.",color:"#302b28",align:"center",visible:true}]);setSelected(id)};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(blocks));alert("Rascunho salvo neste dispositivo. Ainda não foi publicado na loja.")}catch{alert("Não foi possível salvar o rascunho.")}};
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4ddca] bg-white p-4"><div><h2 className="text-xl font-semibold">Editor visual da loja</h2><p className="text-sm text-[#758177]">Organize blocos e veja uma prévia em tempo real.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>setDevice("desktop")} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${device==="desktop"?"bg-[#c92822] text-white":"bg-white"}`}><Monitor size={16}/> Desktop</button><button onClick={()=>setDevice("mobile")} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${device==="mobile"?"bg-[#c92822] text-white":"bg-white"}`}><Smartphone size={16}/> Mobile</button><button onClick={()=>{const previous=history[history.length-1];if(previous){setBlocks(previous);setHistory(h=>h.slice(0,-1))}}} disabled={!history.length} className="rounded-lg border px-3 py-2 disabled:opacity-40"><Undo2 size={16}/></button><button onClick={save} className="flex items-center gap-2 rounded-lg bg-[#c92822] px-4 py-2 text-sm font-semibold text-white"><Save size={16}/> Salvar rascunho</button></div></div>
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
      <aside className="rounded-xl border border-[#e4ddca] bg-white p-4"><h3 className="font-semibold">Estrutura da página</h3><p className="mb-3 text-xs text-[#758177]">Selecione, mova ou oculte blocos.</p><div className="space-y-2">{blocks.map((b,i)=><div key={b.id} className={`rounded-lg border p-2 ${selected===b.id?"border-[#c92822] bg-[#edf4ee]":"border-[#e4ddca]"}`}><button onClick={()=>setSelected(b.id)} className="w-full text-left text-sm font-medium">{b.kind==="hero"?"Destaque principal":b.kind==="banner"?"Banner promocional":b.kind==="button"?"Botão/CTA":"Texto"} · {b.title}</button><div className="mt-2 flex gap-1"><button onClick={()=>move(b.id,-1)} className="rounded border p-1" title="Mover para cima" disabled={i===0}><ChevronUp size={14}/></button><button onClick={()=>move(b.id,1)} className="rounded border p-1" title="Mover para baixo" disabled={i===blocks.length-1}><ChevronDown size={14}/></button><button onClick={()=>update(b.id,{visible:!b.visible})} className="rounded border px-2 text-xs">{b.visible?"Ocultar":"Mostrar"}</button>{b.kind!=="hero"&&<button onClick={()=>{commit(blocks.filter(x=>x.id!==b.id));if(selected===b.id)setSelected(blocks[0]?.id||"")}} className="ml-auto rounded border p-1 text-red-600"><Trash2 size={14}/></button>}</div></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>add("text")} className="rounded-lg border px-2 py-2 text-xs">+ Texto</button><button onClick={()=>add("banner")} className="rounded-lg border px-2 py-2 text-xs">+ Banner</button><button onClick={()=>add("button")} className="rounded-lg border px-2 py-2 text-xs">+ Botão</button><button onClick={()=>add("hero")} className="rounded-lg border px-2 py-2 text-xs">+ Destaque</button></div></aside>
      <div className="min-w-0 rounded-xl border border-[#e4ddca] bg-[#e8e7e1] p-3"><div className="mb-2 flex items-center justify-between text-xs text-[#758177]"><span>PRÉ-VISUALIZAÇÃO · {device==="desktop"?"DESKTOP":"MOBILE"}</span><span>Rascunho</span></div><div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg ${device==="mobile"?"max-w-[390px]":"max-w-full"}`}><div className="flex items-center justify-between bg-[#173b2c] px-4 py-3 text-xs text-white"><b>BRASIL PIZZAS</b><span>☰　🛍</span></div>{blocks.filter(b=>b.visible).map(b=><div key={b.id} onClick={()=>setSelected(b.id)} className={`cursor-pointer border-2 ${selected===b.id?"border-[#d6ad48]":"border-transparent"}`} style={{textAlign:b.align}}>{b.kind==="hero"?<div className="min-h-56 px-5 py-10 text-white" style={{background:`linear-gradient(135deg,${b.color},#102b20)`}}><h2 className="text-3xl font-bold">{b.title}</h2><p className="mt-3">{b.body}</p><span className="mt-5 inline-block rounded-full bg-[#d6ad48] px-4 py-2 font-bold text-[#173b2c]">Ver cardápio</span></div>:b.kind==="banner"?<div className="m-3 rounded-xl px-4 py-6" style={{background:b.color,color:b.color.toLowerCase()==="#d6ad48"?"#173b2c":"white"}}><h3 className="text-xl font-bold">{b.title}</h3><p>{b.body}</p></div>:b.kind==="button"?<div className="p-5"><span className="inline-block rounded-full px-5 py-3 font-bold text-white" style={{background:b.color}}>{b.title}</span></div>:<div className="px-5 py-8" style={{color:b.color}}><h3 className="text-2xl font-bold">{b.title}</h3><p className="mt-2">{b.body}</p></div>}</div>)}</div></div>
      <aside className="rounded-xl border border-[#e4ddca] bg-white p-4"><h3 className="font-semibold">Propriedades</h3>{current?<div className="mt-3 space-y-3"><label className="block text-xs font-medium text-[#758177]">Título / texto<input value={current.title} onChange={e=>update(current.id,{title:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#302b28]"/></label>{current.kind!=="button"&&<label className="block text-xs font-medium text-[#758177]">Descrição<textarea value={current.body} onChange={e=>update(current.id,{body:e.target.value})} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#302b28]"/></label>}<label className="block text-xs font-medium text-[#758177]">Cor<input type="color" value={current.color} onChange={e=>update(current.id,{color:e.target.value})} className="mt-1 h-10 w-full rounded border p-1"/></label><label className="block text-xs font-medium text-[#758177]">Alinhamento<select value={current.align} onChange={e=>update(current.id,{align:e.target.value as Block["align"]})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label><p className="rounded-lg bg-[#f5f2e9] p-3 text-xs text-[#758177]">As alterações são exibidas na prévia enquanto você edita.</p></div>:<p className="mt-3 text-sm text-[#758177]">Selecione um bloco para editar.</p>}</aside>
    </div><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Esta versão salva o rascunho localmente e serve como protótipo de edição. Publicação real e sincronização da estrutura com a loja serão a próxima etapa, após conectar o editor ao armazenamento do site.</p>
  </div>;
}

