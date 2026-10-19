import { createFileRoute, redirect } from "@tanstack/react-router";

// The AutoLedger app is a static site served from public/app.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/app/index.html" });
  },
  head: () => ({
    meta: [
      { title: "AutoLedger — Used Car Partnership" },
      { name: "description", content: "Track cars, costs, partner contributions and profits." },
      { property: "og:title", content: "AutoLedger — Used Car Partnership" },
      { property: "og:description", content: "Track cars, costs, partner contributions and profits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
