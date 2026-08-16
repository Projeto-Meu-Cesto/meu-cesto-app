export type CatalogProduct = {
  id: string;
  marketId: string;
  barcode?: string;
  name: string;
  brand?: string;
  category: string;
  unit: string;
  price: number;
  stockQuantity: number;
  available: boolean;
  imageUrl?: string | null;
  updatedAt: string;
};

export type CatalogSearch = {
  query?: string;
  category?: string;
  onlyAvailable?: boolean;
};

export interface CatalogProvider {
  search(filters?: CatalogSearch): Promise<CatalogProduct[]>;
  getById(productId: string): Promise<CatalogProduct | null>;
}
