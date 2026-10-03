import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

export const metadata: Metadata = {
  title: "後台｜躲貓貓小人",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
