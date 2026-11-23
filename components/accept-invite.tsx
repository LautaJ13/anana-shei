"use client";

import { useState } from "react";
import { acceptInviteAction } from "@/lib/actions/clinic";
import { Button } from "./ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await acceptInviteAction(token);
        if (result && !result.ok) setError(result.error);
        setPending(false);
      }}
    >
      {error ? <p className="mb-3 text-sm text-danger" role="alert">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Aceptando…" : "Aceptar invitación"}</Button>
    </form>
  );
}
