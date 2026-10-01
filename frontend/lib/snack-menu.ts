import products from "../../backend/src/snack-products.json";

export interface SnackProduct {
  id: string;
  name: string;
  price: number;
  type: "Savory" | "Sweet";
  description: string;
  image: string;
}

// Shared by the customer and staff ordering portals. Prices are per pack.
// Use new product IDs when replacing items so old order records keep their meaning.
export const SNACK_PRODUCTS = products as SnackProduct[];
