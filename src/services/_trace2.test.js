import { describe, it, expect, vi, beforeEach } from 'vitest';
// copy of test mocks
class MockFileReader { constructor(){this.onload=null;this.onerror=null;this._file=null;} readAsDataURL(file){this._file=file;queueMicrotask(()=>{this.onload&&this.onload({target:{result:'data:image/png;base64,AAAA'}});});} }
if (typeof globalThis.FileReader === 'undefined') globalThis.FileReader = MockFileReader;
class MockImage { constructor(){this.onload=null;this.onerror=null;this.naturalWidth=100;this.naturalHeight=100;this._src='';} set src(v){this._src=v;queueMicrotask(()=>{this.onload&&this.onload();});} get src(){return this._src;} }
if (typeof globalThis.Image === 'undefined') globalThis.Image = MockImage;
vi.mock('./llmCoach.js', () => {
  class E extends Error { constructor(m,c){super(m);this.code=c;} }
  return {
    LlmCoachError: E,
    isLlmCoachConfigured: vi.fn((s)=>Boolean(s&&s.enabled&&s.apiKey)),
    normalizeLlmCoachSettings: vi.fn((s)=>({enabled:s?.enabled??false,baseUrl:s?.baseUrl||'https://api.openai.com',model:s?.model||'gpt-4o-mini',apiKey:s?.apiKey||''})),
    fetchWithTimeout: vi.fn(),
    extractAssistantContent: vi.fn((p)=>p?.choices?.[0]?.message?.content||''),
    parseCoachJson: vi.fn((str)=>{try{return JSON.parse(str)}catch{return{}}}),
  };
});
import { analyzeBoardImage } from './boardImageAnalyzer.js';
import { fetchWithTimeout } from './llmCoach.js';
const mockSettings = {enabled:true,baseUrl:'https://api.openai.com',model:'gpt-4o-mini',apiKey:'sk-test-key'};
function makeMockResponse(content, usage=null){ return {ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content}}],usage:usage})}; }
describe('trace-image', ()=>{
  it('only', async ()=>{
    const analysisResult = JSON.stringify({boardSize:15,stones:[],currentPlayer:'black',recommended:{row:7,col:7},alternatives:[],reason:'',risk:'',plan:'',confidence:0.5});
    fetchWithTimeout.mockResolvedValueOnce(makeMockResponse(analysisResult, {total_tokens:250}));
    const r = await analyzeBoardImage({file:{type:'image/png',size:1024,name:'board.png'},settings:mockSettings});
    console.log('TRACE result keys:', r?Object.keys(r):r);
    console.log('TRACE imageDataUrl:', r?.imageDataUrl);
    console.log('TRACE usage:', r?.usage);
    console.log('TRACE boardSize:', r?.boardSize);
    console.log('TRACE typeof result:', typeof r);
    console.log('TRACE full:', JSON.stringify(r));
    expect(r.imageDataUrl).toBeDefined();
  });
});
