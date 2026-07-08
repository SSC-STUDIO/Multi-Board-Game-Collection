import { describe, it, vi } from 'vitest';
vi.mock('./llmCoach.js', () => ({
  LlmCoachError: class extends Error { constructor(m,c){super(m);this.code=c;} },
  isLlmCoachConfigured: vi.fn(()=>true),
  normalizeLlmCoachSettings: vi.fn((s)=>({enabled:true,baseUrl:'https://api.openai.com',model:'gpt-4o-mini',apiKey:'sk-test-key'})),
  fetchWithTimeout: vi.fn(async()=>({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:'{"boardSize":15,"stones":[],"currentPlayer":"black","recommended":{"row":7,"col":7},"alternatives":[],"reason":"","risk":"","plan":"","confidence":0.5}'}}],usage:{total_tokens:250}})})),
  extractAssistantContent: vi.fn((p)=>p?.choices?.[0]?.message?.content||''),
  parseCoachJson: vi.fn((s)=>{try{return JSON.parse(s)}catch{return{}}}),
}));
const { analyzeBoardImage } = await import('./boardImageAnalyzer.js');
describe('dbg',()=>{
  it('trace', async()=>{
    try{
      const r = await analyzeBoardImage({file:{type:'image/png',size:1024,name:'b.png'},settings:{enabled:true,apiKey:'k'}});
      console.log('RESULT keys:', r?Object.keys(r):r);
      console.log('imageDataUrl:', r?.imageDataUrl);
      console.log('usage:', r?.usage);
    }catch(e){ console.log('THREW:', e?.code, e?.message); }
  });
});
