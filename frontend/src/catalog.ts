import { getJson } from "./http";

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
  return getJson<CatalogBody>("/api/catalog");
}
