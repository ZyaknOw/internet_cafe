export interface SnackProduct {
  id: string;
  name: string;
  price: number;
  type: "Savory" | "Sweet";
  description: string;
  image: string;
}

// Shared by the customer and staff ordering portals so prices and availability
// stay aligned from browsing through checkout.
export const SNACK_PRODUCTS: SnackProduct[] = [
  { id: "sn-1", name: "Crispy Truffle Fries", price: 95, type: "Savory", description: "Golden fries tossed with truffle seasoning.", image: "/images/coffee/truffle-fries.jpg" },
  { id: "sn-2", name: "Grilled Club Sandwich", price: 145, type: "Savory", description: "Toasted bread stacked with chicken and fresh greens.", image: "/images/coffee/artisan-sandwich.jpg" },
  { id: "sn-3", name: "Loaded Cheese Fries", price: 120, type: "Savory", description: "Crispy fries with a warm, creamy cheese topping.", image: "/images/coffee/truffle-fries.jpg" },
  { id: "sn-4", name: "Chicken Sandwich", price: 135, type: "Savory", description: "A hearty chicken sandwich, toasted until golden.", image: "/images/coffee/artisan-sandwich.jpg" },
  { id: "sn-5", name: "Seasoned Fries", price: 75, type: "Savory", description: "A generous serving of crisp, seasoned fries.", image: "/images/coffee/truffle-fries.jpg" },
  { id: "sn-6", name: "Ham & Cheese Toastie", price: 110, type: "Savory", description: "Warm toasted sandwich with melty cheese.", image: "/images/coffee/artisan-sandwich.jpg" },
  { id: "sn-7", name: "Chocolate Brownie", price: 65, type: "Sweet", description: "A rich, fudgy chocolate treat for your break.", image: "/images/coffee/artisan-sandwich.jpg" },
  { id: "sn-8", name: "Cookie Bites", price: 55, type: "Sweet", description: "Soft baked cookie bites, perfect for sharing.", image: "/images/coffee/truffle-fries.jpg" },
];
