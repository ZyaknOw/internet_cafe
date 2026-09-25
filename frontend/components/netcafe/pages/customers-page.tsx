"use client";

import { History, Pencil, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { Header } from "../app-shell";
import { Customer } from "../types";

export function CustomersPage({ customers, onAdd, onTopUp, onHistory, onEdit, onDelete }: { customers: Customer[]; onAdd: () => void; onTopUp: (customer: Customer) => void; onHistory: (customer: Customer) => void; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void }) {
  return <>
    <Header title="Customers"><button onClick={onAdd}><Plus size={18} /> Add Customer</button></Header>
    <div className="page-body">
      <div className="search"><Search size={19} /><input placeholder="Search customers..." /></div>
      <div className="table-card"><table>
        <thead><tr><th>Name</th><th>Contact</th><th>Status</th><th>Balance</th><th>Total Spent</th><th>Member Since</th><th className="actions-heading">Actions</th></tr></thead>
        <tbody>{customers.map((customer) => <tr key={customer.id}>
          <td><b>{customer.userCode ? `${customer.userCode} · ` : ""}{customer.name}</b></td>
          <td>{customer.contact}</td>
          <td><span className={customer.approved ? "approved" : "pending"}>{customer.approved ? "Approved" : "Pending"}</span></td>
          <td><code>₱{customer.balance.toFixed(2)}</code></td>
          <td>₱{customer.totalSpent.toFixed(2)}</td>
          <td>{customer.memberSince}</td>
          <td className="table-actions">
            <button title="Top up balance" onClick={() => onTopUp(customer)}><WalletCards size={18} /></button>
            <button title="Session history" onClick={() => onHistory(customer)}><History size={18} /></button>
            <button title="Edit customer" onClick={() => onEdit(customer)}><Pencil size={18} /></button>
            <button title="Delete customer" className="delete-action" onClick={() => onDelete(customer)}><Trash2 size={18} /></button>
          </td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </>;
}
