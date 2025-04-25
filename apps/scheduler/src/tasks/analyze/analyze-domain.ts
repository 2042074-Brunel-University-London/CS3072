import { modelsAPIClient } from "@/lib/api/models";
import { addJob, createTask } from "@/utils";
import { z } from "zod";

import { db } from "@senka/db/client";
import { Domain } from "@senka/db/schema";

export type AnalyzeDomainPayload = z.infer<typeof AnalyzeDomainPayload>;
export const AnalyzeDomainPayload = z.object({
  domain: z.string(),
});

const getSubdomainPermutations = (domain: string): string[] => {
  const parts = domain.split(".");
  const permutations: string[] = [];

  // Start from the first parent domain and work our way up
  for (let i = 1; i < parts.length - 1; i++) {
    const subdomain = parts.slice(i).join(".");
    permutations.push(subdomain);
  }

  return permutations;
};

export const analyzeDomain = createTask({
  name: "analyze-domain",
  schema: AnalyzeDomainPayload,
  task: async ({ domain }) => {
    console.log(`Analyzing domain: ${domain}`);
    const findDomain = await db.query.Domain.findFirst({
      where: (Domain, { eq }) => eq(Domain.url, domain),
    });

    if (!findDomain) {
      console.error(`Domain ${domain} not found`);
      return;
    }

    // Skip if the domain was checked in the last 7 days
    if (
      findDomain.lastCheckedAt &&
      findDomain.lastCheckedAt > new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
    ) {
      console.log(`Domain ${domain} was checked in the last 7 days, skipping`);
      return;
    }

    const cleanedDomain = domain.replace("https://", "").replace("http://", "");

    // Get all subdomain permutations
    const subdomains = getSubdomainPermutations(cleanedDomain);

    // Create a job for each subdomain
    for (const subdomain of subdomains) {
      console.log(`Creating job for subdomain: ${subdomain}`);
      await addJob({
        name: "analyze-domain",
        payload: { domain: subdomain },
        options: {
          jobKey: `analyze-domain:${subdomain}`,
          priority: 5,
          maxAttempts: 5,
        },
      });
    }

    const { data } = await modelsAPIClient.post("/domains/analyze", {
      url: domain,
    });
  },
});
