/**
 * Full-document reload, isolated in its own module.
 *
 * `window.location.reload` is defined as a non-configurable own property in jsdom
 * (and moved between the instance and the prototype across jsdom majors), so
 * component tests cannot stub it directly. Routing the call through this helper
 * keeps the components testable without patching engine internals.
 */
export function reloadPage(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
