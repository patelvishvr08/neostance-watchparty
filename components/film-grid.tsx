"use client";
import { useState,useEffect,useRef } from "react";
import type { FilmData } from "../core/types";
import { Plus,Play,Bookmark,Heart,EyeOff,Download,Volume2,VolumeX,Info,X,Check } from "lucide-react";

type Props={films:FilmData[];inRoom?:boolean;saved:string[];bookmark:(id:string)=>void;addToQueue:(film:FilmData)=>void;openCreate:(id:string)=>void;favorites?:string[];downloads?:string[];downloading?:string[];favorite?:(id:string)=>void;hide?:(id:string)=>void;download?:(film:FilmData)=>void;onOpen?:(film:FilmData)=>void};
function FilmCard({film,index,p}:{film:FilmData;index:number;p:Props}) {
  const [expanded,setExpanded]=useState(false),[muted,setMuted]=useState(true),[failed,setFailed]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),video=useRef<HTMLVideoElement>(null),root=useRef<HTMLElement>(null);
  const isSaved=p.saved.includes(film.id),liked=p.favorites?.includes(film.id),cached=p.downloads?.includes(film.id),busy=p.downloading?.includes(film.id);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(!expanded)return;
    setMuted(true);setFailed(false);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)video.current?.play().catch(()=>{});
  },[expanded]);
  const show=()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setExpanded(true),350);};
  const leave=()=>{if(timer.current)clearTimeout(timer.current);setExpanded(false);};
  const open=()=>{setExpanded(false);if(p.inRoom)p.addToQueue(film);else if(p.onOpen)p.onOpen(film);else p.openCreate(film.id);};
  return <article ref={root} className={`film-card ${expanded?'preview-open':''}`} style={{'--film-color':film.color,'--i':index} as React.CSSProperties} onPointerEnter={e=>{if(e.pointerType==='mouse')show();}} onPointerLeave={e=>{if(e.pointerType==='mouse')leave();}} onKeyDown={e=>{if(e.key==='Escape'){setExpanded(false);root.current?.querySelector<HTMLButtonElement>('.film-detail-button')?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setExpanded(false);}}>
    <button className="film-art" onClick={open} aria-label={`${p.inRoom?'Add to queue':p.onOpen?'Play download':'Start a room with'} ${film.title}`}><img src={film.poster} alt={`A scene from ${film.title}`} loading="lazy"/><span className="film-shade"/><span className="film-category">{film.category}</span><span className="film-hover-play">{p.inRoom?<Plus size={24}/>:<Play size={24} fill="currentColor"/>}</span><span className="film-duration">{film.duration}</span></button>
    <div className="film-card-title"><div><h3>{film.title}</h3><p>{film.year} <span>·</span> {film.category}</p></div><div className="film-card-tools"><button className="icon-button film-detail-button" onClick={()=>setExpanded(!expanded)} aria-label={`Details and preview for ${film.title}`} aria-expanded={expanded}><Info size={18}/></button><button className={`icon-button bookmark ${isSaved?'is-saved':''}`} onClick={()=>p.bookmark(film.id)} aria-label={`${isSaved?'Remove':'Add'} ${film.title} ${isSaved?'from':'to'} watch later`} aria-pressed={isSaved}><Bookmark size={18} fill={isSaved?'currentColor':'none'}/></button></div></div>
    {expanded&&<div className="film-preview" role="group" aria-label={`${film.title} preview and options`}>
      <div className="preview-media">{!failed?<video ref={video} src={film.src} poster={film.poster} muted={muted} loop playsInline preload="metadata" onCanPlay={()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)video.current?.play().catch(()=>{});}} onError={()=>setFailed(true)}/>:<img src={film.poster} alt=""/>}<div className="preview-media-shade"/><span className="preview-label">{['Ambient','Sports'].includes(film.category)?'SILENT MOTION STUDY':'PREVIEW'}</span><button className="preview-close" aria-label="Close preview" onClick={()=>setExpanded(false)}><X size={17}/></button><button className="preview-volume" aria-label={muted?'Unmute preview':'Mute preview'} onClick={()=>{setMuted(!muted);video.current?.play().catch(()=>{});}}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button></div>
      <div className="preview-body"><div className="preview-meta"><span>{film.category}</span><span>{film.year}</span><span>{film.duration}</span></div><h3>{film.title}</h3><p>{film.description}</p><div className="preview-main-actions"><button className="button button-amber" onClick={open}>{p.inRoom?<Plus size={16}/>:<Play size={16} fill="currentColor"/>}{p.inRoom?'Add to queue':p.onOpen?'Play download':'Watch together'}</button><button className={`preview-round ${isSaved?'selected':''}`} aria-label={isSaved?'Remove from watch later':'Watch later'} title="Watch later" aria-pressed={isSaved} onClick={()=>p.bookmark(film.id)}>{isSaved?<Check size={18}/>:<Bookmark size={18}/>}</button>{p.favorite&&<button className={`preview-round ${liked?'selected':''}`} aria-label={liked?'Remove favourite':'Add favourite'} title="Favourite" aria-pressed={!!liked} onClick={()=>p.favorite?.(film.id)}><Heart size={18} fill={liked?'currentColor':'none'}/></button>}</div><div className="preview-extra-actions">{p.hide&&<button onClick={()=>{p.hide?.(film.id);setExpanded(false);}}><EyeOff size={14}/>Not interested</button>}{p.download&&<button disabled={busy} onClick={()=>p.download?.(film)}><Download size={14}/>{busy?'Saving…':cached?'Remove download':'Save offline'}</button>}</div><small className="preview-credit">{film.credit}</small></div>
    </div>}
  </article>;
}
export function FilmGrid(props:Props) {return <div className={props.inRoom?'library-grid':'film-grid'}>{props.films.map((film,index)=><FilmCard key={film.id} film={film} index={index} p={props}/>)}</div>;}
