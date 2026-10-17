"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Search, X, ArrowUpRight, Heart, Bookmark, Download, Play, Trash2 } from "lucide-react";
import { catalog, searchCatalog } from "../core/catalog.mjs";
import { Modal } from "./ui";
import type { FilmData } from "../core/types";
const CACHE="afterhours-video-v1";
const readList=(key:string)=>{try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x.filter((id:unknown)=>typeof id==="string"&&catalog.some(f=>f.id===id)):[];}catch{return [];}};
export function usePersonalLibrary(notify:(s:string)=>void) {
  const [favorites,setFavorites]=useState<string[]>([]),[hidden,setHidden]=useState<string[]>([]),[downloads,setDownloads]=useState<string[]>([]),[downloading,setDownloading]=useState<string[]>([]);
  useEffect(()=>{
    setFavorites(readList("afterhours-favorites"));setHidden(readList("afterhours-hidden"));
    if("caches" in window)caches.open(CACHE).then(async cache=>{
      const stored:string[]=[];
      for(const film of catalog){
        try {
          let current=await cache.match(film.src);
          // Upgrade a previously saved clip to the compatible, cache-safe asset.
          if(!current && await cache.match(film.src.replace('/neo-','/'))){
            const response=await fetch(film.src,{signal:AbortSignal.timeout(15000)});
            if(response.ok){await cache.put(film.src,response);current=await cache.match(film.src);}
          }
          if(current){stored.push(film.id);setDownloads([...stored]);}
        }catch{ /* Keep other saved clips available if one upgrade is offline. */ }
      }
      setDownloads(stored);
    }).catch(()=>{});
  },[]);
  function favorite(id:string){const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);localStorage.setItem("afterhours-favorites",JSON.stringify(next));}
  function hide(id:string){const next=hidden.includes(id)?hidden.filter(x=>x!==id):[...hidden,id];setHidden(next);localStorage.setItem("afterhours-hidden",JSON.stringify(next));notify(next.includes(id)?"Hidden from Discover and suggestions. Restore it from your library controls.":"Back in your collection.");}
  function restore(){setHidden([]);localStorage.setItem("afterhours-hidden","[]");notify("Hidden stories are back in Discover.");}
  async function download(film:FilmData){
    if(!("caches" in window)){notify("This browser needs HTTPS or localhost to save clips. You can still watch together online.");return;}
    if(downloading.includes(film.id))return;
    setDownloading(v=>[...v,film.id]);
    try{
      const cache=await caches.open(CACHE);
      if(downloads.includes(film.id)){await cache.delete(film.src);setDownloads(v=>v.filter(x=>x!==film.id));notify("Removed the saved clip from this browser.");return;}
      const response=await fetch(film.src,{signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw new Error("The clip could not be downloaded.");
      await cache.put(film.src,response);
      setDownloads(v=>[...new Set([...v,film.id])]);notify("Clip saved in this browser. Open Downloads to play it.");
    }catch{notify("Could not save this clip. Check your connection and available browser storage.");}
    finally{setDownloading(v=>v.filter(x=>x!==film.id));}
  }
  return {favorites,hidden,downloads,downloading,favorite,hide,restore,download};
}
export function GlobalSearch({onChoose}:{onChoose:(id:string)=>void}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const closeSearch=useCallback(()=>setOpen(false),[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="/"&&!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)){e.preventDefault();setOpen(true);}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
  useEffect(()=>{if(open)setTimeout(()=>input.current?.focus(),80);},[open]);
  const results=searchCatalog(query);
  return <><form className="global-search-trigger neo-search-pill" role="search" onSubmit={e=>{e.preventDefault();setOpen(true);}}><button type="submit" aria-label="Open Neostance search"><Search size={19}/></button><input aria-label="Search Neostance" placeholder="Search titles, genres, moods" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);}}/><kbd>/</kbd></form>{open&&<Modal title="Find your next screening." subtitle="Search titles, genres, moods or a year. A little typo is welcome." close={closeSearch} wide><label className="search-box global-search-input"><Search size={21}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search all stories" placeholder="Try ‘calm space’, ‘football’ or ‘sintal’"/>{query&&<button aria-label="Clear search" onClick={()=>setQuery("")}><X size={17}/></button>}</label><div className="search-suggestions">{['Calm','Football','Animation','Adventure'].map(x=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}</div><p className="search-result-count">{query?`${results.length} ${results.length===1?'match':'matches'} for “${query}”`:'Explore the collection'}</p><div className="search-result-list">{results.map(f=><button className="search-result" key={f.id} onClick={()=>{setOpen(false);onChoose(f.id);}}><img src={f.poster} alt=""/><span><strong>{f.title}</strong><small>{f.category} · {f.year} · {f.duration}</small><p>{f.description}</p></span><ArrowUpRight size={20}/></button>)}{!results.length&&<p className="search-no-results">No matches yet. Try a title, a shorter phrase or a different mood.</p>}</div></Modal>}</>;
}
export function LibraryShelves({saved,favorites,downloads,onSection}:{saved:string[];favorites:string[];downloads:string[];onSection:(s:string)=>void}) {
  const shelves=[{id:'saved',label:'Watch later',sub:'Keep a good night lined up.',ids:saved,icon:Bookmark},{id:'favorites',label:'Your favourites',sub:'The stories you come back to.',ids:favorites,icon:Heart},{id:'downloads',label:'Downloaded clips',sub:'Saved right here, on this browser.',ids:downloads,icon:Download}];
  return <section className="library-shelves reveal"><div className="shelf-heading"><span className="eyebrow">YOUR OWN LITTLE CINEMA</span><h2>Make room for your favourites.</h2></div><div className="shelf-grid">{shelves.map(({id,label,sub,ids,icon:Icon})=><button className={`shelf-card shelf-${id}`} key={id} onClick={()=>onSection(id)}><div className="shelf-covers" aria-hidden="true">{ids.length?ids.slice(0,3).map((n,i)=>{const f=catalog.find(x=>x.id===n);return f?<img key={n} src={f.poster} alt="" style={{'--cover-index':i} as React.CSSProperties}/>:null;}):<div className="shelf-illustration"><Icon size={40}/><i/><i/></div>}</div><span className="shelf-icon"><Icon size={19}/></span><strong>{label}<ArrowUpRight size={18}/></strong><small>{sub}</small><span className="shelf-count">{ids.length} {ids.length===1?'story':'stories'}</span></button>)}</div></section>;
}
export function DownloadPlayer({film,close}:{film:FilmData;close:()=>void}) {
  const [src,setSrc]=useState("");
  useEffect(()=>{let cancelled=false,url="";caches.open(CACHE).then(c=>c.match(film.src)).then(async response=>{if(!response)return;const blob=await response.blob();if(!cancelled){url=URL.createObjectURL(blob);setSrc(url);}}).catch(()=>{});return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};},[film.src]);
  return <Modal title={film.title} subtitle="Saved on this browser. Local playback is independent of your watch party." close={close} wide>{src?<video className="offline-video" src={src} poster={film.poster} controls playsInline autoPlay muted/>:<p className="fine-print">Loading your saved clip. If browser storage was cleared, save this clip again.</p>}<p className="fine-print">{film.credit}</p><p className="fine-print">Room sync and chat need a connection. Saved clips remain subject to your browser’s storage limits.</p></Modal>;
}
