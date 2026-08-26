'use client';

import { useEffect, useState } from 'react';

const INTRO_KEY = 'mzcmg-sonic-lab-suite-intro-v1';
const DONATION_URL = process.env.NEXT_PUBLIC_SONIC_LAB_DONATION_URL || '';

export default function SuiteChrome({children}:{children:React.ReactNode}) {
  const [introOpen,setIntroOpen] = useState(false);
  const [supportOpen,setSupportOpen] = useState(false);
  const [amount,setAmount] = useState('10');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INTRO_KEY) !== 'seen') setIntroOpen(true);
    } catch {
      setIntroOpen(true);
    }
  },[]);

  function closeIntro() {
    try { window.localStorage.setItem(INTRO_KEY,'seen'); } catch {}
    setIntroOpen(false);
  }

  function beginDonation() {
    if (!DONATION_URL) return;
    const numeric = Number(amount);
    const safeAmount = Number.isFinite(numeric) ? Math.max(1,Math.min(5000,numeric)) : 10;
    const target = DONATION_URL.includes('{amount}')
      ? DONATION_URL.replace('{amount}',String(safeAmount))
      : DONATION_URL;
    window.open(target,'_blank','noopener,noreferrer');
  }

  const barStyle:React.CSSProperties = {
    position:'sticky',top:0,zIndex:50,
    background:'#eee9dc',color:'#1d1d1b',borderBottom:'2px solid #1d1d1b',
    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  };
  const buttonStyle:React.CSSProperties = {
    minHeight:44,border:'1px solid #1d1d1b',borderRadius:0,background:'transparent',color:'#1d1d1b',
    padding:'0 14px',font:'700 11px ui-monospace, SFMono-Regular, Menlo, monospace',letterSpacing:'.08em',cursor:'pointer'
  };

  return (
    <>
      <header style={barStyle}>
        <div style={{maxWidth:1720,margin:'0 auto',padding:'8px 18px',display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
            <strong style={{fontFamily:'Arial, Helvetica, sans-serif',fontSize:18,letterSpacing:'-.03em'}}>MZCMG // SONIC LAB</strong>
            <span style={{fontSize:10,letterSpacing:'.12em',color:'#77756e'}}>FREE / DONATION-SUPPORTED INSTRUMENT SUITE</span>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <button type="button" onClick={()=>setIntroOpen(true)} style={buttonStyle}>ABOUT</button>
            <button type="button" onClick={()=>setSupportOpen(v=>!v)} style={{...buttonStyle,background:'#dfff00'}}>SUPPORT / DONATE</button>
          </div>
          {supportOpen && (
            <div style={{width:'100%',borderTop:'1px solid rgba(29,29,27,.32)',paddingTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <label style={{fontSize:10,fontWeight:700,letterSpacing:'.08em'}}>PAY WHAT YOU WILL $</label>
              <input
                aria-label="Donation amount in dollars"
                inputMode="decimal"
                value={amount}
                onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,''))}
                style={{width:92,minHeight:44,border:'1px solid #1d1d1b',borderRadius:0,background:'#faf6eb',color:'#1d1d1b',padding:'0 10px',font:'700 16px ui-monospace, SFMono-Regular, Menlo, monospace'}}
              />
              <button type="button" onClick={beginDonation} disabled={!DONATION_URL} style={{...buttonStyle,background:DONATION_URL?'#1d1d1b':'#d5d0c4',color:DONATION_URL?'#eee9dc':'#77756e',cursor:DONATION_URL?'pointer':'not-allowed'}}>
                {DONATION_URL?'CONTINUE TO DONATION':'DONATION LINK PENDING'}
              </button>
              <span style={{fontSize:10,color:'#77756e',maxWidth:560,lineHeight:1.4}}>
                SONIC LAB is free to use. Contributions help keep the suite accessible and support continued instrument development.
              </span>
            </div>
          )}
        </div>
      </header>

      {children}

      {introOpen && (
        <div role="presentation" style={{position:'fixed',inset:0,zIndex:100,background:'rgba(29,29,27,.72)',display:'grid',placeItems:'center',padding:16}} onMouseDown={e=>{if(e.target===e.currentTarget) closeIntro();}}>
          <section role="dialog" aria-modal="true" aria-labelledby="sonic-suite-intro-title" style={{width:'min(680px,100%)',background:'#eee9dc',color:'#1d1d1b',border:'2px solid #1d1d1b',padding:20,fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:'.14em',marginBottom:10}}>MZCMG // SONIC LAB // FIELD NOTE 01</div>
            <h1 id="sonic-suite-intro-title" style={{fontFamily:'Arial, Helvetica, sans-serif',fontSize:'clamp(34px,7vw,64px)',lineHeight:.92,letterSpacing:'-.06em',margin:'0 0 18px',textTransform:'uppercase'}}>Play first.<br/>Compose through experience.</h1>
            <div style={{borderTop:'1px solid #1d1d1b',borderBottom:'1px solid #1d1d1b',padding:'12px 0',marginBottom:16,display:'grid',gap:8}}>
              <div style={{fontSize:12,fontWeight:800}}>RECOMMENDED // DESKTOP</div>
              <div style={{fontSize:12}}>Also functional on mobile. Larger screens provide the most direct access to the full instrument surface.</div>
            </div>
            <p style={{fontFamily:'Arial, Helvetica, sans-serif',fontSize:17,lineHeight:1.45,margin:'0 0 12px'}}>
              SONIC LAB is a free, donation-supported suite of intuitive experiential instruments for sound, rhythm, and composition. The tools are designed to invite play at whatever pace or level of musical production feels appropriate to the person using them.
            </p>
            <p style={{fontFamily:'Arial, Helvetica, sans-serif',fontSize:17,lineHeight:1.45,margin:'0 0 20px'}}>
              The suite will remain free. If you enjoy using these instruments, please consider supporting continued development with the <strong>SUPPORT / DONATE</strong> control at the top of the device.
            </p>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:10,color:'#77756e',letterSpacing:'.08em'}}>ACCESSIBLE INSTRUMENTS // CONTINUOUS DEVELOPMENT // PAY WHAT YOU WILL</span>
              <button type="button" onClick={closeIntro} style={{...buttonStyle,background:'#dfff00',minWidth:150}}>ENTER SONIC LAB</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
