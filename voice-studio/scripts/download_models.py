from pathlib import Path
import os,json,time
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HOME']=str(ROOT/'cache'/'huggingface')
os.environ['GRADIO_ANALYTICS_ENABLED']='False'
from huggingface_hub import snapshot_download
for repo in ['Qwen/Qwen3-TTS-12Hz-1.7B-Base','Qwen/Qwen3-TTS-Tokenizer-12Hz']:
    print('Downloading',repo,flush=True)
    snapshot_download(repo,local_dir=ROOT/'models'/repo.split('/')[-1])
print('DOWNLOAD COMPLETE',flush=True)
