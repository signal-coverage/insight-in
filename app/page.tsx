import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Login } from "@/components/Login";

export default async function LoginPage() {
  const { isAuthenticated } = await auth();

  if (isAuthenticated) {
    redirect("/dashboard");
  }

  return <Login />;
}
