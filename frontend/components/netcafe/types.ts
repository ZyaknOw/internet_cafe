export type Role = "Administrator" | "Staff";
export type PageId = "stations" | "customers" | "reports" | "admin" | "profiles" | "settings";
export type Station = { id: number; name: string; type: "Standard" | "VIP"; rate: number; active: boolean; pending?: boolean; customer?: string; customerId?: string; startedAt?: number; notes?: string };
export type Customer = { id: string | number; userCode?: string; name: string; contact: string; approved: boolean; balance: number; totalSpent: number; memberSince: string; role?: "customer" | "staff" };
export type Profile = { id: string | number; userCode?: string; firstName: string; middleName: string; lastName: string; name: string; address: string; contact: string; email: string; password?: string; role: Role; color: string };
export type Session = { id: number; station: string; customer: string; startedAt: number; endedAt: number; total: number; payment: string };
