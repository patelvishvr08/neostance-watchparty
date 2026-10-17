"""Original procedural football-stadium motion study; no recorded match footage."""
from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import numpy as np,math,random,subprocess
ROOT=Path(__file__).resolve().parents[1];W,H=1280,720;FPS=24;N=240
random.seed(31)
seats=[(random.uniform(0,math.tau),random.uniform(0,1),random.choice(['#d7be82','#6e93ae','#b9ad8b','#c6c9b9'])) for _ in range(1600)]
stars=[(random.randrange(W),random.randrange(330),random.randrange(1,3)) for _ in range(75)]
players=[(random.uniform(-45,45),random.uniform(-26,26),i%2) for i in range(22)]
proc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-pix_fmt','yuv420p','-profile:v','high','-preset','fast','-crf','24','-movflags','+faststart',str(ROOT/'public/media/neo-floodlights.mp4')],stdin=subprocess.PIPE)
for frame in range(N):
 t=frame/FPS;theta=.89+.07*math.sin(t/10*math.pi);cam=np.array([190*math.cos(theta),145-6*math.sin(t*.3),190*math.sin(theta)])
 target=np.array([0,8,0]);forward=(target-cam);forward/=np.linalg.norm(forward);right=np.cross(forward,np.array([0,1,0]));right/=np.linalg.norm(right);up=np.cross(right,forward)
 def project(p):
  v=np.array(p)-cam;depth=np.dot(v,forward);return (W/2+np.dot(v,right)*930/depth,H*.55-np.dot(v,up)*930/depth)
 im=Image.new('RGB',(W,H));pix=np.zeros((H,W,3),dtype=np.uint8)
 for y in range(H):pix[y,:,0]=int(7+9*y/H);pix[y,:,1]=int(12+12*y/H);pix[y,:,2]=int(23+8*y/H)
 im=Image.fromarray(pix);d=ImageDraw.Draw(im)
 for x,y,r in stars:d.ellipse((x,y,x+r,y+r),fill='#718193')
 # Stepped stadium bowl, sorted from back to front.
 quads=[]
 for level in range(11):
  rx,rz,yy=75+level*2.8,50+level*2.5,3+level*3.4
  for i in range(100):
   a,b=i/100*math.tau,(i+1)/100*math.tau
   pts=[(rx*math.cos(a),yy,rz*math.sin(a)),(rx*math.cos(b),yy,rz*math.sin(b)),((rx+2.6)*math.cos(b),yy+3.2,(rz+2.4)*math.sin(b)),((rx+2.6)*math.cos(a),yy+3.2,(rz+2.4)*math.sin(a))]
   depth=np.dot(np.mean(pts,axis=0)-cam,forward);col=['#263440','#293d49','#36434b'][level%3];quads.append((depth,pts,col))
 for _,pts,col in sorted(quads,reverse=True):d.polygon([project(p) for p in pts],fill=col)
 # Field and alternating turf bands.
 for j in range(12):
  z1=-34+j*68/12;z2=-34+(j+1)*68/12
  d.polygon([project(p) for p in [(-53,0,z1),(53,0,z1),(53,0,z2),(-53,0,z2)]],fill='#37664b' if j%2 else '#41765a')
 def line(pts,color='#b2c4a1',width=2):d.line([project(p) for p in pts],fill=color,width=width)
 line([(-51,0,-32),(51,0,-32),(51,0,32),(-51,0,32),(-51,0,-32)])
 line([(0,0,-32),(0,0,32)])
 line([(10*math.cos(a),0,10*math.sin(a)) for a in np.linspace(0,math.tau,100)])
 for side in [-1,1]:
  line([(side*51,0,-19),(side*34,0,-19),(side*34,0,19),(side*51,0,19)])
  line([(side*51,0,-8),(side*47,0,-8),(side*47,4,-8),(side*51,4,-8),(side*51,4,8),(side*47,4,8),(side*47,0,8),(side*51,0,8)],'#d6d9c0',2)
 # Tiny players and ball move continuously, rather than simulating a recorded event.
 for i,(x,z,team) in enumerate(players):
  x+=math.sin(t*.8+i)*2.5;z+=math.cos(t*.6+i)*1.4
  px,py=project((x,0,z));d.ellipse((px-3,py-2,px+3,py+2),fill='#1a3d2a');d.line((px,py,px,py-7),fill='#f4bd76' if team else '#c5dfef',width=3);d.ellipse((px-1,py-9,px+1,py-7),fill='#d5bca4')
 bx,by=project((math.sin(t*.9)*12,0,math.cos(t*.5)*9));d.ellipse((bx-2,by-2,bx+2,by+2),fill='#eeeee7')
 # Individual crowd lights follow the bowl geometry.
 for a,q,col in seats:
  p=((76+q*28)*math.cos(a),6+q*32,(51+q*25)*math.sin(a));x,y=project(p)
  d.ellipse((x,y,x+1.4,y+1.4),fill=col)
 # Floodlight masts and atmospheric beams.
 glow=Image.new('RGBA',(W,H));gd=ImageDraw.Draw(glow)
 for x,z in [(-90,-65),(90,-65),(-90,65),(90,65)]:
  bottom=project((x,0,z));top=project((x,75,z));d.line((*bottom,*top),fill='#829092',width=2)
  gd.ellipse((top[0]-34,top[1]-34,top[0]+34,top[1]+34),fill=(230,221,184,60))
  for a in [-12,-4,4,12]:d.rectangle((top[0]+a-2,top[1]-2,top[0]+a+2,top[1]+2),fill='#f9efd1')
 glow=glow.filter(ImageFilter.GaussianBlur(17));im=Image.alpha_composite(im.convert('RGBA'),glow).convert('RGB')
 # Gentle letterbox shading and soft edge vignette.
 arr=np.asarray(im).astype(float);yy,xx=np.mgrid[0:H,0:W];vig=np.clip(1-.28*((xx-W/2)/(W/2))**2-.2*((yy-H/2)/(H/2))**2,.45,1);arr*=vig[:,:,None]
 im=Image.fromarray(np.clip(arr,0,255).astype('uint8'))
 if frame==72:im.save(ROOT/'public/media/floodlights.jpg',quality=93)
 proc.stdin.write(im.tobytes())
proc.stdin.close();assert proc.wait()==0
print('Rendered original 10-second 1280x720 stadium animation.')
