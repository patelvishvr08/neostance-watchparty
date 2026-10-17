"use client";
import { useCallback, useEffect, useState } from "react";
import { UserRound, ArrowUpRight, ShieldCheck, LogOut, RefreshCw } from "lucide-react";
import { Modal } from "./ui";

type Identity = {
  available: boolean;
  user: { displayName: string; fullName: string | null; email: string } | null;
  signInUrl?: string;
  signOutUrl?: string;
};

export function AccountMenu({ onName }: { onName: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [failed, setFailed] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const returnTo = `${location.pathname}${location.search}${location.hash}`;
      const response = await fetch(`/api/identity?returnTo=${encodeURIComponent(returnTo)}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Identity unavailable");
      const result: Identity = await response.json();
      setIdentity(result);
      if (result.user) onName(result.user.fullName || result.user.email.split("@")[0]);
    } catch { setFailed(true); }
  }, [onName]);
  useEffect(() => { void load(); }, [load]);
  const user = identity?.user;
  return <>
    <button className={`account-trigger ${user ? "is-signed-in" : ""}`} onClick={() => setOpen(true)} aria-label={user ? "Open your account" : "Sign in or sign up"}>
      {user ? <span className="account-initial">{user.displayName.slice(0, 1).toUpperCase()}</span> : <UserRound size={17} />}
      <span>{user ? (user.fullName?.split(" ")[0] || "Account") : "Sign in"}</span>
    </button>
    {open && <Modal title={user ? "Your seat is saved." : "A name behind the screen."} subtitle={user ? "You're signed in to Neostance." : "Sign in or create an account. Movie nights are open to guests, too."} close={close}>
      <div className="account-content">
        <div className="account-art" aria-hidden="true"><span>N</span><i /><i /></div>
        {failed ? <><h3>We couldn't reach sign-in.</h3><p>You can still explore the collection and create or join a room.</p><button className="button button-amber" onClick={() => void load()}><RefreshCw size={16} /> Try again</button></>
        : !identity ? <p role="status">Checking your account…</p>
        : user ? <><div className="account-person"><ShieldCheck size={23} /><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div><p>Your account provides your name. Watch later, favourites and downloads stay in this browser. Room invitations and room controls remain separate.</p><a className="button button-cream" href={identity.signOutUrl} target="_top"><LogOut size={17} /> Sign out</a></>
        : identity.available ? <><div className="account-provider"><ShieldCheck size={19} /><span>Secure account sign-in</span></div><a className="button button-cream account-continue" href={identity.signInUrl} target="_top">Continue with ChatGPT <ArrowUpRight size={18} /></a><p className="account-google-note">Want to use Google? Choose <strong>Continue with Google</strong> on the ChatGPT sign-in screen. You can also create an account there.</p><p className="fine-print">You'll return here after sign-in. Neostance never receives your Google password. Your saved picks stay in this browser.</p><button className="text-button" onClick={close}>Keep exploring as a guest <ArrowUpRight size={15} /></button></>
        : <><h3>Your cinema, without an account.</h3><p>This standalone edition uses guest room names. Account sign-in is available on the hosted Neostance website.</p><a className="button button-cream" href="https://afterhours-watchparty-vishv.yogita18892009patel.chatgpt.site" target="_blank" rel="noopener noreferrer">Open hosted Neostance <ArrowUpRight size={17} /></a></>}
      </div>
    </Modal>}
  </>;
}
