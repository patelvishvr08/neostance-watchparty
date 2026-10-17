"""Optional build-time codec and decode audit. Requires ffmpeg/ffprobe, not the app runtime."""
from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parents[1]
clips=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {catalog} from "./core/catalog.mjs"; console.log(JSON.stringify(catalog));'],cwd=root))
report=[]
for clip in clips:
 path=root/'public'/clip['src'].lstrip('/')
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
 video=next(x for x in data['streams'] if x['codec_type']=='video')
 assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p',clip['id']
 raw=path.read_bytes();assert 0<raw.find(b'moov')<raw.find(b'mdat'),clip['id']
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),'-f','null','-'],check=True)
 report.append({'id':clip['id'],'file':clip['src'],'duration':round(float(data['format']['duration']),2),'video_codec':video['codec_name'],'profile':video['profile'],'pixel_format':video['pix_fmt'],'dimensions':[video['width'],video['height']],'audio':[s['codec_name'] for s in data['streams'] if s['codec_type']=='audio'],'fast_start':True,'full_decode_passed':True})
(root/'docs/media-audit.json').write_text(json.dumps({'clips':report,'scope':'Local file structure, codec and full decode checks. Not a browser or real-device synchronization test.'},indent=2)+'\n')
print(json.dumps(report,indent=2))
