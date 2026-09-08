/** Native request metadata shared by the HTTP adapter and WS preparation. */
export const CODEX_RESPONSES_LITE_HEADER = "x-openai-internal-codex-responses-lite";
export const CODEX_RESPONSES_LITE_METADATA_KEY = "ws_request_header_x_openai_internal_codex_responses_lite";
export const CODEX_ROUTING_HINT_HEADER = "x-codex-routing-hint";

/** Canonical requests omit optional routing hints. */
export function applyCodexRoutingHint(headers: Headers, _body: unknown): void {
  headers.delete(CODEX_ROUTING_HINT_HEADER);
}
