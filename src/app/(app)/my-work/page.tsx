import type { Metadata } from "next";
import { Suspense } from "react";
import { MyWorkView } from "./my-work-view";
import Loading from "./loading";

export const metadata: Metadata = { title: "My Work" };

export default function MyWorkPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyWorkView />
    </Suspense>
  );
}
