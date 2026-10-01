import React from "react";
import { Building2, FileText, Receipt, ShoppingCart, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";

const areas = [
  { title: "Clients", note: "Customer records and contacts", icon: UsersRound },
  { title: "Sales", note: "Quotations, invoices and payments", icon: FileText },
  { title: "Purchases", note: "Requests, orders and supplier invoices", icon: ShoppingCart },
  { title: "Expenses", note: "Business and project expenditure", icon: Receipt },
  { title: "Suppliers", note: "Supplier records and performance", icon: Building2 },
];

export const BusinessPage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Business</h1>
      <p className="mt-1 text-sm text-muted-foreground">Commercial work grouped in one place instead of a crowded sidebar.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {areas.map(({ title, note, icon: Icon }) => (
        <Card key={title} className="group cursor-default">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
            <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{note}</p></div>
          </div>
        </Card>
      ))}
    </div>
    <Card className="border-dashed">
      <p className="font-medium">Business workflows are staged behind this simple hub.</p>
      <p className="mt-1 text-sm text-muted-foreground">Projects, tasks and documents are live first so the operating system stays easy to learn. Sales, purchases and expenses can now be added without changing the navigation.</p>
    </Card>
  </div>
);

export default BusinessPage;
