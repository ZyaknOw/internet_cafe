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
export const SNACK_PRODUCTS: SnackProduct[] = [
  { id: "sn-crackers", name: "Crackers", price: 10, type: "Savory", description: "A pack of crackers for a quick snack during your PC session.", image: "/images/snacks/crackers.png" },
  { id: "sn-stick-crackers", name: "Stick Crackers", price: 10, type: "Savory", description: "A pack of crunchy stick crackers for a simple snack break.", image: "/images/snacks/stick-crackers.png" },
];
