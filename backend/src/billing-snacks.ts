import products from "./snack-products.json";

export function priceBillingSnacks(selections: { id: string; quantity: number }[]) {
  const seen = new Set<string>();
  return selections.map(({ id, quantity }) => {
    const product = products.find((item) => item.id === id);
    if (!product || seen.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Choose valid snacks and quantities (1–99 per item).");
    }
    seen.add(id);
    return { id, name: product.name, price: product.price, quantity };
  });
}
