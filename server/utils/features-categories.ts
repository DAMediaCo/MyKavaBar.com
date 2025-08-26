// Use the same categories and icons as before
export const staticCategories = [
  { id: 1, name: "Tech & Connectivity" },
  { id: 2, name: "Entertainment" },
  { id: 3, name: "Seating & Environment" },
  { id: 4, name: "Events & Community" },
  { id: 5, name: "Food & Drink" },
  { id: 6, name: "Merch & Loyalty" },
];

// Helper to get category by id
export function getCategoryById(id: number) {
  return staticCategories.find((c) => c.id === id) || null;
}

export const isValidCategoryId = (id: number) =>
  staticCategories.some((c) => c.id === id);
