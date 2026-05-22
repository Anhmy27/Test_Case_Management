import { redirect } from "next/navigation";

export default function AdminWorkspaceIndex() {
  redirect("/workspace/admin/dashboard");
}