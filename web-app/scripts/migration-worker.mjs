import routes from "../tool-routes.json" with { type: "json" };

/** Resolve retired landing URLs without losing supported tool state. */
export function migrationDestination(url) {
  if (!["/", "/edit", "/edit/", "/edit/index.html"].includes(url.pathname))
    return null;
  const id = url.searchParams.get("tool");
  const tool = routes.find((route) => route.id === id);
  if (id !== null && !tool) return "invalid";
  if (url.pathname === "/" && !tool) return null;
  const destination = new URL(url);
  destination.pathname = tool?.path ?? "/";
  destination.searchParams.delete("tool");
  return destination;
}

export default {
  async fetch(request, env) {
    const destination = migrationDestination(new URL(request.url));
    if (destination === "invalid") {
      return new Response(
        "Unknown PDF tool. Return to the homepage to choose a tool.",
        {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }
    if (destination) return Response.redirect(destination.href, 301);
    return env.ASSETS.fetch(request);
  },
};
