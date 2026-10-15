"""Local inference worker. The studio backend never imports torch."""
from pathlib import Path
import os,threading,time
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HOME']=str(ROOT/'cache/huggingface')
os.environ['HF_HUB_OFFLINE']='1'
os.environ['GRADIO_ANALYTICS_ENABLED']='False'
from fastapi import FastAPI,HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel,Field
app=FastAPI(); lock=threading.Lock(); model=None
app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost'])
class Request(BaseModel):
    reference:str
    transcript:str=Field(min_length=1,max_length=10000)
    text:str=Field(min_length=1,max_length=10000)
    language:str='English'
    output:str
@app.get('/health')
def health(): return {'status':'ready','loaded':model is not None}
@app.post('/generate')
def generate(r:Request):
    global model
    reference=Path(r.reference).resolve(); output=Path(r.output).resolve()
    if not reference.is_relative_to(ROOT/'data') or not output.is_relative_to(ROOT/'data'): raise HTTPException(400,'Audio must be inside the studio data folder.')
    if not lock.acquire(blocking=False): raise HTTPException(409,'Inference is busy. Wait for the current generation.')
    try:
        import torch,soundfile as sf
        from qwen_tts import Qwen3TTSModel
        torch.set_num_threads(4)
        if model is None:
            if not torch.cuda.is_available(): raise RuntimeError('CUDA is unavailable. Check the NVIDIA driver.')
            free,_=torch.cuda.mem_get_info()
            if free<6*2**30: raise RuntimeError('Less than 6 GiB GPU memory is free. Free resources before generating.')
            model=Qwen3TTSModel.from_pretrained(str(ROOT/'models/Qwen3-TTS-12Hz-1.7B-Base'),device_map='cuda:0',dtype=torch.bfloat16,attn_implementation='sdpa',local_files_only=True)
        t=time.time(); torch.cuda.reset_peak_memory_stats()
        wavs,sr=model.generate_voice_clone(text=r.text,language=r.language,ref_audio=str(reference),ref_text=r.transcript,max_new_tokens=2048)
        import numpy as np
        if len(wavs[0]) == 0 or not np.isfinite(wavs[0]).all():
            raise RuntimeError('The model returned empty or invalid audio.')
        sf.write(output,wavs[0],sr,subtype='PCM_16')
        return {'seconds':len(wavs[0])/sr,'elapsed':time.time()-t,'peak_gpu_gib':torch.cuda.max_memory_allocated()/2**30}
    except Exception as e:
        raise HTTPException(500,f'{type(e).__name__}: {e}')
    finally: lock.release()
