/** @format uuid */
export type EntityId = string;

/** @format date-time */
export type Timestamp = string;

export type OrderStatus =
  | { kind: 'Draft' }
  | { kind: 'Placed'; placedAt: Timestamp }
  | { kind: 'Confirmed'; confirmedAt: Timestamp }
  | { kind: 'Shipped'; trackingNumber: string; carrier: string; shippedAt: Timestamp }
  | { kind: 'Delivered'; deliveredAt: Timestamp }
  | { kind: 'Cancelled'; reason: string; cancelledAt: Timestamp }
  | { kind: 'RefundRequested'; refundReason: string; requestedAt: Timestamp };

export type LineItem = {
  lineId: EntityId;
  productId: EntityId;
  quantity: number;
  unitPrice: number;
};

export type OrderState = {
  orderId: EntityId;
  customerId: EntityId;
  status: OrderStatus;
  lines: LineItem[];
  inventoryReserved: boolean;
  requiresManualReview: boolean;
  refundAutoApproved: boolean;
  paymentRef?: string;
};
