export interface CatalogBody {
  name: string;
  display_name: string;
  type: string;
  radius_km: number;
  color: string;
  texture: string | null;
  orbital_period_days: number | null;
  default_visible: boolean;
  orbitals: CatalogBody[];
}

export async function fetchCatalog(): Promise<CatalogBody> {
  const response = await fetch("/api/catalog");
  if (!response.ok) {
    throw new Error(`catalog request failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<CatalogBody>;
}
