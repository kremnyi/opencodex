/** Owns one physical socket; request listeners belong to the exchange, not this object. */
export class CodexWsSession {
  readonly socket: WebSocket;
  opened = false;
  closed = false;
  busy = false;
  private owner?: (reason: Error) => void;

  constructor(url: string, headers: Record<string, string>, readonly retainable = false,
    private readonly changed: () => void = () => {}, proxy?: string) {
    this.socket = new WebSocket(url, { headers, ...(proxy ? { proxy } : {}) } as unknown as string[]);
    this.socket.addEventListener("open", this.onOpen);
    this.socket.addEventListener("message", this.onIdleMessage);
    this.socket.addEventListener("close", this.onClose);
    this.socket.addEventListener("error", this.onIdleError);
  }

  reserve(): boolean {
    if (this.closed || this.busy || (this.opened && this.socket.readyState !== undefined && this.socket.readyState !== 1)) return false;
    this.busy = true;
    const socket = this.socket as WebSocket & { ref?: () => void };
    try { socket.ref?.(); } catch { /* optional keepalive hint */ }
    return true;
  }

  bindOwner(owner: (reason: Error) => void): () => void {
    if (!this.busy || this.closed || this.owner) throw new Error("codex websocket lease is unavailable");
    this.owner = owner;
    return () => { if (this.owner === owner) this.owner = undefined; };
  }

  release(_completedId: string | null): void {
    this.owner = undefined;
    this.dispose();
  }

  dispose(reason = new Error("codex websocket session disposed")): void {
    if (this.closed) return;
    this.closed = true;
    const owner = this.owner;
    this.owner = undefined;
    this.detach();
    try { owner?.(reason); } finally {
      this.busy = false;
      try { this.socket.close(); } catch { /* already closing */ }
      if (this.retainable) {
        try { (this.socket as WebSocket & { terminate?: () => void }).terminate?.(); } catch { /* already closed */ }
      }
      this.changed();
    }
  }

  private onOpen = (): void => { this.opened = true; };
  private onIdleMessage = (): void => {
    if (!this.busy) this.dispose(new Error("codex websocket received unsolicited idle data"));
  };
  private onIdleError = (): void => { if (!this.busy) this.dispose(); };
  private onClose = (): void => {
    this.closed = true;
    this.busy = false;
    this.detach();
    this.changed();
    // The active exchange's close listener retains pre-send fallback semantics.
  };
  private detach(): void {
    this.socket.removeEventListener("open", this.onOpen);
    this.socket.removeEventListener("message", this.onIdleMessage);
    this.socket.removeEventListener("close", this.onClose);
    this.socket.removeEventListener("error", this.onIdleError);
  }
}
