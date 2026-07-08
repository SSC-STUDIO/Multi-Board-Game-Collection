import { describe, it, vi } from 'vitest';
class MockFileReader {
  constructor() { this.onload = null; this.onerror = null; this._file = null; }
  readAsDataURL(file) { this._file = file; queueMicrotask(() => { this.onload && this.onload({ target: { result: 'data:image/png;base64,AAAA' } }); }); }
}
if (typeof globalThis.FileReader === 'undefined') globalThis.FileReader = MockFileReader;
class MockImage {
  constructor() { this.onload = null; this.onerror = null; this.naturalWidth = 100; this.naturalHeight = 100; this._src = ''; }
  set src(value) { this._src = value; queueMicrotask(() => { this.onload && this.onload(); }); }
  get src() { return this._src; }
}
if (typeof globalThis.Image === 'undefined') globalThis.Image = MockImage;
vi.mock('./llmCoach.js', () => ({
  LlmCoachError: class extends Error { constructor(m,c){super(m);this.code=c;} },
  isLlmCoachConfigured: vi.fn(()=>true),
  normalizeLlmCoachSettings: vi.fn((s)=>({enabled:true,baseUrl:'https://api.openai.com',model:'gpt-4o-mini',apiKey:'sk-test-key'})),
  fetchWithTimeout: vi.fn(async()=>({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:JSON.stringify({boardSize:15,stones:[],currentPlayer:'black',recommended:{row:7,col:7},alternatives:[],reason:'',risk:'',plan:'',confidence:0.5})}}],usage:{total_tokens:250}})})),
  extractAssistantContent: vi.fn((p)=>p?.choices?.[0]?.message?.content||''),
  parseCoachJson: vi.fn((s)=>{try{return JSON.parse(s)}catch{return{}}}),
}));
const { analyzeBoardImage } = await import('./boardImageAnalyzer.js');
describe('trace', ()=>{
  it('trace', async()=>{
    try {
      const r = await analyzeBoardImage({file:{type:'image/png',size:1024,name:'b.png'},settings:{enabled:true,apiKey:'k'}});
      console.log('RESULT TYPE:', typeof r);
      console.log('RESULT:', JSON.stringify(r));
      console.log('imageDataUrl:', r && r.imageDataUrl);
      console.log('usage:', r && r.usage);
    } catch(e) { console.log('THREW:', e.code, e.message, e.stack); }
  });
});
