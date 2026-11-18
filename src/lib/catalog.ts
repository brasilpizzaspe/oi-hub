export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number | null;
  active: boolean;
  image: string;
};

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://scocgrreppdbtqctesio.supabase.co";
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_JGN8bSFsGCxTOIubmNmHIA_J36i5Mpp";

export const initialProducts: Product[] = [
  { id: "mussarela", name: "Mussarela", category: "Salgadas", description: "Molho de tomate, mussarela e orégano.", price: null, active: true, image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85" },
  { id: "calabresa", name: "Calabresa", category: "Salgadas", description: "Molho de tomate, mussarela, calabresa, cebola, azeitona e orégano.", price: null, active: true, image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=85" },
  { id: "frango-requeijao", name: "Frango com requeijão", category: "Salgadas", description: "Molho de tomate, mussarela, frango cozido desfiado, requeijão culinário e orégano.", price: null, active: true, image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=900&q=85" },
  { id: "portuguesa", name: "Portuguesa", category: "Salgadas", description: "Molho de tomate, mussarela, presunto, ovo cozido, cebola, ervilha e azeitona.", price: null, active: true, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85" },
  { id: "marguerita", name: "Marguerita", category: "Salgadas", description: "Molho de tomate, mussarela, tomate, parmesão e manjericão.", price: null, active: true, image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=85" },
  { id: "bacon", name: "Bacon", category: "Salgadas", description: "Molho de tomate, mussarela, bacon, cebola e orégano.", price: null, active: true, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85" },
  { id: "chocolate", name: "Chocolate com granulado", category: "Doces", description: "Chocolate ao leite e granulado de chocolate.", price: null, active: true, image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85" },
  { id: "romeu-julieta", name: "Romeu e Julieta", category: "Doces", description: "Mussarela e goiabada.", price: null, active: true, image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=900&q=85" },
  { id: "coca-1l", name: "Coca-Cola 1 litro", category: "Bebidas", description: "Refrigerante para acompanhar.", price: null, active: true, image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=900&q=85" },
  { id: "antarctica-1l", name: "Antarctica 1 litro", category: "Bebidas", description: "Refrigerante para acompanhar.", price: null, active: true, image: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=85" },
];

export async function fetchStoreProducts(): Promise<Product[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return initialProducts;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,category,description,price,active,image_url&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY } },
    );
    if (!response.ok) return initialProducts;
    const rows = (await response.json()) as Array<Omit<Product, "image"> & { image_url: string | null }>;
    if (!Array.isArray(rows) || rows.length === 0) return initialProducts;
    return rows.map(({ image_url, ...product }) => ({
      ...product,
      price: product.price === null ? null : Number(product.price),
      image: image_url || initialProducts.find((item) => item.id === product.id)?.image || "",
    }));
  } catch {
    return initialProducts;
  }
}

export type StoreImages = { hero: string | null; heroVideo: string | null; about: string | null };
export async function fetchStoreImages(): Promise<StoreImages> {
  const fallback: StoreImages = { hero: null, heroVideo: null, about: null };
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/site_images?select=slot,image_url,video_url`, { headers: { apikey: SUPABASE_KEY } });
    if (!response.ok) return fallback;
    const rows = await response.json() as Array<{ slot: string; image_url: string | null; video_url: string | null }>;
    return {
      hero: rows.find(row => row.slot === "hero")?.image_url || null,
      heroVideo: rows.find(row => row.slot === "hero")?.video_url || null,
      about: rows.find(row => row.slot === "about")?.image_url || null,
    };
  } catch { return fallback; }
}
