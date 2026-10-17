// A small, deliberately curated catalogue. Media stays on our own origin.
export const catalog = [
  {
    id: "sintel",
    title: "Sintel",
    year: 2010,
    category: "Fantasy",
    duration: "0:52",
    seconds: 52,
    color: "#b65e3c",
    poster: "/media/sintel.jpg",
    src: "/media/neo-sintel.mp4",
    label: "A little courage. A whole new world.",
    description:
      "A young traveler, a lost dragon, and a journey worth sharing. The Blender Foundation’s open-movie trailer.",
    credit: "© Blender Foundation • sintel.org • CC BY 3.0",
    tags: ["adventure", "dragon", "animation", "epic"],
  },
  {
    id: "bunny",
    title: "Big Buck Bunny",
    year: 2008,
    category: "Animation",
    duration: "0:33",
    seconds: 33,
    color: "#9caa77",
    poster: "/media/bunny.jpg",
    src: "/media/neo-bunny.mp4",
    label: "Small trouble. Big main-character energy.",
    description:
      "One very large rabbit has had enough of the forest’s tiny troublemakers. An open-movie trailer with a sense of humor.",
    credit: "© Blender Foundation • bigbuckbunny.org • CC BY 3.0",
    tags: ["comedy", "forest", "funny", "animals"],
  },
  {
    id: "orbit",
    title: "Quiet Orbit",
    year: 2026,
    category: "Ambient",
    duration: "0:24",
    seconds: 24,
    color: "#737db2",
    poster: "/media/orbit.jpg",
    src: "/media/neo-orbit.mp4",
    label: "Some nights, you just need a little space.",
    description:
      "An original, sound-free motion study: distant stars, a soft horizon, and room to slow down. Made for Neostance.",
    credit: "Original procedural motion study • Neostance • CC0",
    tags: ["space", "calm", "stars", "sci fi", "night"],
  },
  {
    id: "tides",
    title: "Amber Tides",
    year: 2026,
    category: "Ambient",
    duration: "0:24",
    seconds: 24,
    color: "#c58b53",
    poster: "/media/tides.jpg",
    src: "/media/neo-tides.mp4",
    label: "Stay for one more sunset.",
    description:
      "An original, sound-free motion study of light on water. A tiny escape for your next shared screen break.",
    credit: "Original procedural motion study • Neostance • CC0",
    tags: ["sunset", "ocean", "calm", "waves", "warm"],
  },
  {
    id: "floodlights", title: "Under the Floodlights", year: 2026,
    category: "Sports", duration: "0:10", seconds: 10, color: "#bba758",
    poster: "/media/floodlights.jpg", src: "/media/neo-floodlights.mp4",
    label: "One stadium. Thousands of shared moments.",
    description: "An original animated football stadium: sweeping camera motion, moving players and warm floodlights. A small procedural sports motion study for your shared screen.",
    credit: "Original procedural stadium animation • Neostance • CC0",
    tags: ["football", "soccer", "stadium", "sport", "tournament", "crowd", "energy"],
  },
  {
    id: "caminandes", title: "Caminandes: Gran Dillama", year: 2013,
    category: "Animation", duration: "2:26", seconds: 146, color: "#ca8a53",
    poster: "/media/caminandes.jpg", src: "/media/neo-caminandes.mp4",
    label: "A little llama. A very big dilemma.",
    description: "Koro discovers that the best grass is on the other side of a fence. A complete, dialogue-free animated comedy from the Blender Institute — perfect for a quick shared screening.",
    credit: "© 2013 Blender Foundation / caminandes.org • CC BY 3.0",
    tags: ["comedy", "funny", "animals", "llama", "short film", "adventure", "patagonia"],
  },
  {
    id: "steel", title: "Tears of Steel", year: 2012,
    category: "Sci-Fi", duration: "0:40", seconds: 40, color: "#67949c",
    poster: "/media/steel.jpg", src: "/media/neo-steel.mp4",
    label: "Some memories are worth fighting for.",
    description: "A glimpse of an Amsterdam transformed by machines. The official teaser for Blender's live-action and visual-effects open film. This selection is the teaser, rather than the full film.",
    credit: "© 2012 Blender Foundation / mango.blender.org • CC BY 3.0",
    tags: ["robots", "science fiction", "future", "action", "amsterdam", "teaser"],
  },
  {
    id: "dream", title: "Elephants Dream", year: 2006,
    category: "Sci-Fi", duration: "1:15", seconds: 75, color: "#8a748f",
    poster: "/media/dream.jpg", src: "/media/neo-dream.mp4",
    label: "Follow the wires. Question the world.",
    description: "Two travellers navigate a strange mechanical world. The original 2005 teaser for the 2006 open film, with an experimental score and a surreal sense of scale.",
    credit: "© 2006 Blender Foundation / Netherlands Media Art Institute / elephantsdream.org • CC BY 2.5",
    tags: ["machines", "science fiction", "surreal", "mystery", "animation", "teaser"],
  },
];

// Rank whole phrases, titles and multi-word moods before fuzzy fallback.
const normalize = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const distance = (a,b) => {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) { const next=[i];for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next; }
  return row[b.length];
};
const synonyms={relax:"calm",relaxing:"calm",peaceful:"calm",fun:"funny",humor:"comedy",humour:"comedy",scifi:"space",sports:"sport",football:"football",sea:"ocean"};
export function searchCatalog(query="",category="All") {
  const q=normalize(query).slice(0,120), tokens=q.split(" ").filter(Boolean).slice(0,10);
  return catalog.filter(f=>category==="All"||f.category===category).map((film,index)=>{
    if(!q)return {film,score:1,index};
    const title=normalize(film.title), text=normalize(`${film.title} ${film.year} ${film.category} ${film.tags.join(" ")} ${film.description}`), words=text.split(" ");
    let score=title===q?200:title.startsWith(q)?100:title.includes(q)?80:text.includes(q)?50:0;
    const matches=tokens.every(raw=>{
      const token=synonyms[raw]||raw;
      if(text.includes(token)){score+=title.includes(token)?20:8;return true;}
      if(token.length<3)return false;
      const allowance=token.length>5?2:1;
      if(words.some(w=>Math.abs(w.length-token.length)<=allowance&&distance(token,w)<=allowance)){score+=3;return true;}
      return false;
    });
    return {film,score:matches?score:0,index};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.film);
}

export function recommendCatalog(saved=[],favorites=[],hidden=[]) {
  const excluded=new Set(hidden), preferred=new Set([...saved,...favorites]);
  const seeds=catalog.filter(f=>preferred.has(f.id));
  const candidates=catalog.filter(f=>!excluded.has(f.id)&&!preferred.has(f.id));
  return candidates.map((film,index)=>({film,index,score:seeds.reduce((sum,seed)=>{
    const weight=favorites.includes(seed.id)?2:1;
    return sum+weight*((seed.category===film.category?5:0)+film.tags.filter(t=>seed.tags.includes(t)).length*2);
  },0)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.film);
}
