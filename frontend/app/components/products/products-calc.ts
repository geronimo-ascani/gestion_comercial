export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateMarginValue(
  purchasePrice: number,
  marginPercent: number
): number {
  return roundMoney(purchasePrice * (1 + marginPercent / 100));
}

export function calculateSalePrice(
  purchasePrice: number,
  marginPercent: number,
  ivaRate: number
): number {
  return roundMoney(
    purchasePrice * (1 + marginPercent / 100) * (1 + ivaRate)
  );
}