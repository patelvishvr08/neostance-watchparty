"""Rebuild the two original geometric motion studies. Requires Pillow, numpy and ffmpeg.
No external artwork or footage is used for these two clips.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, subprocess, math, os
W,H,FPS,SECONDS=960,540,24,24
OUT=os.path.join(os.path.dirname(__file__),'..','public','media')
os.makedirs(OUT,exist_ok=True)
rng=np.random.default_rng(42)
y,x=np.mgrid[0:H,0:W]; nx=x/W; ny=y/H
stars=[(int(rng.integers(0,W)),int(rng.integers(0,int(H*.8))),float(rng.random())) for _ in range(220)]

def orbit(t):
    a=np.zeros((H,W,3),float)
    for c,(top,bot) in enumerate([(10,27),(16,29),(29,48)]): a[:,:,c]=top+(bot-top)*ny
    glow=np.exp(-((nx-.64)**2/.085+(ny-.5)**2/.22))
    a+=glow[:,:,None]*np.array([30,27,35])
    im=Image.fromarray(np.uint8(np.clip(a,0,255))).convert('RGB'); d=ImageDraw.Draw(im)
    for sx,sy,b in stars:
        tw=.65+.35*math.sin(t*.8+b*20)
        col=tuple(int(z*(.4+b*.6)*tw) for z in (205,208,226))
        d.ellipse((sx,sy,sx+(1 if b<.88 else 2),sy+(1 if b<.88 else 2)),fill=col)
    # The ellipse and the planet are vector geometry rather than an image asset.
    cx,cy,r=628,267,132
    for rr in range(r,0,-1):
        u=rr/r
        col=(int(34+30*(1-u)),int(41+24*(1-u)),int(61+39*(1-u)))
        d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=col)
    d.arc((cx-r,cy-r,cx+r,cy+r),190,305,fill=(171,158,177),width=2)
    d.ellipse((cx-230,cy-54,cx+230,cy+54),outline=(112,107,135),width=1)
    ang=t*.19-.7; px=cx+230*math.cos(ang); py=cy+54*math.sin(ang)
    d.ellipse((px-4,py-4,px+4,py+4),fill=(233,196,160))
    # Quiet foreground ridge.
    ridge=[(0,H),(0,460),(150,425),(278,453),(415,436),(555,475),(725,449),(850,473),(W,451),(W,H)]
    d.polygon(ridge,fill=(10,15,24))
    return im

def tides(t):
    sky=np.zeros((H,W,3),float)
    horizon=.59
    warm=np.clip(ny/horizon,0,1)
    for c,(top,bot) in enumerate([(40,183),(45,114),(56,66)]): sky[:,:,c]=top+(bot-top)*warm
    sun=np.exp(-((nx-.63)**2/.045+(ny-.5)**2/.03))
    sky+=sun[:,:,None]*np.array([42,31,17])
    sea=ny>horizon
    depth=np.clip((ny-horizon)/(1-horizon),0,1)
    waves=(np.sin(ny*120+t*.75+np.sin(nx*9+t*.2)*.5)+np.sin(ny*198-t*.6+nx*3))*.5
    refl=np.exp(-((nx-.63)/(0.025+.22*depth))**2)*(1-depth*.65)*np.maximum(0,waves+.1)
    for c,(base,light) in enumerate([(25,132),(37,83),(43,30)]):
        sky[:,:,c]=np.where(sea,base+depth*4+waves*4+refl*light,sky[:,:,c])
    im=Image.fromarray(np.uint8(np.clip(sky,0,255)));d=ImageDraw.Draw(im)
    d.ellipse((568,230,643,305),fill=(245,188,112))
    d.polygon([(0,338),(78,320),(120,327),(194,314),(280,328),(355,316),(435,331),(484,324),(550,335),(0,355)],fill=(49,47,40))
    d.polygon([(W,H),(W,450),(873,463),(814,480),(731,493),(696,H)],fill=(16,25,27))
    return im

for name,func in [('orbit',orbit),('tides',tides)]:
    cmd=['ffmpeg','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',os.path.join(OUT,name+'.mp4'),'-loglevel','error']
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for frame in range(FPS*SECONDS):
        im=func(frame/FPS)
        if frame==FPS*4: im.save(os.path.join(OUT,name+'.jpg'),quality=94)
        p.stdin.write(im.tobytes())
    p.stdin.close()
    if p.wait(): raise RuntimeError('ffmpeg failed')
    print('Generated',name,flush=True)
