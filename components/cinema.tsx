"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Pause, Play, Users } from "lucide-react";
import type { Room, RoomAction } from "../core/types";

// Decorative media is optional: respect reduced motion and data-saving settings.
export function CinemaMotion({ src = "/media/neo-sintel.mp4", poster = "/media/sintel-hero.jpg" }: { src?: string; poster?: string }) {
  const [motion, setMotion] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const dataSaver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const update = () => setMotion(!preference.matches && !dataSaver);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const update = () => {
      if (motion && !document.hidden) element.play().catch(() => setMotion(false));
      else element.pause();
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [motion, src]);
  return (
    <>
      {motion && <video key={src} ref={video} className="hero-motion" src={src} poster={poster} muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />}
      <div className={`projector-light ${motion ? "moving" : ""}`} aria-hidden="true"><i /><i /><i /></div>
      <div className="cinema-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <button className="motion-control" aria-pressed={motion} onClick={() => setMotion(!motion)}>
        {motion ? <Pause size={12} /> : <Play size={12} />}
        {motion ? "Pause ambience" : "Play ambience"}
      </button>
    </>
  );
}

export function ReadyRoom({ room, serverNow, act }: { room: Room; serverNow: number; act: RoomAction }) {
  const [busy, setBusy] = useState(false);
  const people = room.members.filter((m) => m.online && serverNow - m.lastSeen < 30000);
  const ready = people.filter((m) => m.ready).length;
  const me = room.members.find((m) => m.id === room.memberId);
  const isHost = room.hostId === room.memberId;
  const playing = room.playback.playing;
  const counting = playing && room.playback.updatedAt > serverNow;
  const send = async (action: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await act(action); } finally { setBusy(false); }
  };
  return (
    <section className={`ready-room ${playing ? "is-playing" : ""}`} aria-label="Ready check">
      <div className="ready-orbit" aria-hidden="true"><Clapperboard size={18} /></div>
      <div className="ready-copy">
        <strong>{counting ? "Meet you on the other side of five." : playing ? "The night is rolling." : "Popcorn? Good seat? Everyone ready?"}</strong>
        <span>{playing ? "One shared timeline. Your own volume." : `${ready} of ${people.length} online ${people.length === 1 ? "person" : "people"} ready · start together in five`}</span>
      </div>
      <div className="ready-seats" aria-label={`${ready} of ${people.length} people ready`}>
        {people.slice(0, 10).map((m) => <span key={m.id} className={m.ready ? "seat ready" : "seat"} title={`${m.name}: ${m.ready ? "ready" : "getting settled"}`}>{m.ready ? <Check size={12} /> : m.name.charAt(0).toUpperCase()}</span>)}
        {people.length > 10 && <span className="seat">+{people.length - 10}</span>}
      </div>
      {!playing && <button className={`ready-button ${me?.ready ? "selected" : ""}`} disabled={busy} aria-pressed={!!me?.ready} onClick={() => send({ type: "ready", ready: !me?.ready })}>
        {me?.ready ? <Check size={15} /> : <Users size={15} />}{me?.ready ? "I’m ready" : "Mark me ready"}
      </button>}
      {isHost && !playing && <button className="button button-amber button-small" disabled={busy || !people.length || ready !== people.length} title={ready !== people.length ? "Everyone online needs to mark themselves ready" : "Start a shared five-second countdown"} onClick={() => send({ type: "countdown" })}><Play size={14} />Start together</button>}
      {isHost && counting && <button className="ready-button" disabled={busy} onClick={() => send({ type: "playback", mediaId: room.playback.media.id, position: room.playback.position, playing: false })}>Cancel start</button>}
    </section>
  );
}

export function OpeningSequence() {
  const [open,setOpen]=useState(false);
  const skip=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(new URLSearchParams(location.search).has('room')||sessionStorage.getItem('neostance-opening-v2')||matchMedia('(prefers-reduced-motion: reduce)').matches||(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData)return;
    sessionStorage.setItem('neostance-opening-v2','seen');setOpen(true);
    const focus=setTimeout(()=>skip.current?.focus(),50),timer=setTimeout(()=>setOpen(false),4700);
    return()=>{clearTimeout(focus);clearTimeout(timer);};
  },[]);
  if(!open)return null;
  return <div className="opening-sequence" role="dialog" aria-modal="true" aria-label="Neostance cinematic opening" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='Tab'){e.preventDefault();skip.current?.focus();}}}><video src="/media/neo-floodlights.mp4" poster="/media/floodlights.jpg" autoPlay muted playsInline preload="metadata"/><div className="opening-shade"/><div className="opening-copy"><span>DIFFERENT PLACES. ONE SHARED MOMENT.</span><strong>Neostance<span>.</span></strong><p>The best seat is together.</p><i/></div><button ref={skip} onClick={()=>setOpen(false)}>Skip intro <Play size={13}/></button><small>Original stadium motion study</small></div>;
}
export function AmbientBackdrop({ src = "/media/neo-sintel.mp4", poster = "/media/sintel-hero.jpg" }: { src?: string; poster?: string }) {
  const [enabled,setEnabled]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setEnabled(!motion.matches&&!(navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData);
    update();motion.addEventListener('change',update);return()=>motion.removeEventListener('change',update);
  },[]);
  const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{if(!enabled)return;const update=()=>{if(document.hidden||paused)ref.current?.pause();else ref.current?.play().catch(()=>{});};update();document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[enabled,paused,src]);
  return <><div className="ambient-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${poster})` }}>{enabled&&<video key={src} ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata"/>}<div/></div>{enabled&&<button className="background-motion-toggle" onClick={()=>setPaused(!paused)} aria-pressed={!paused}>{paused?<Play size={12}/>:<Pause size={12}/>}Background motion {paused?'off':'on'}</button>}</>;
}
