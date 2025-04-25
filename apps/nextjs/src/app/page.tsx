import { Suspense } from "react";

import { Graph } from "~/app/_components/graph";
import { api, HydrateClient } from "~/trpc/server";

// import { AuthShowcase } from "./_components/auth-showcase";

export default function HomePage() {
  // You can await this here if you don't want to show Suspense fallback below
  void api.user.graph.prefetch();

  return (
    <HydrateClient>
      <main className="h-screen">
        <Suspense
          fallback={
            <div className="flex w-full flex-col gap-4">
              Prefetching user graph data...
            </div>
          }
        >
          <Graph />
        </Suspense>
      </main>
    </HydrateClient>
  );
}
