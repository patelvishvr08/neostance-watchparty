// Keep auth return destinations on this origin, including a room invite query.
export function safeRelativeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname.replace(/\/+$/, ""))) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
