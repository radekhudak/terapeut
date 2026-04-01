import { redirect } from "next/navigation";
import { TestPageClient } from "./test-page-client";

export default function TestPage() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.TEST_MODE_SECRET
  ) {
    redirect("/");
  }

  return <TestPageClient />;
}
