export default function ExperimentalVortexLayout({children}:{children:React.ReactNode}) {
  return (
    <div style={{background:'#050505',minHeight:'100vh'}}>
      <div style={{position:'sticky',top:0,zIndex:60,display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'8px 14px',background:'#daff00',color:'#050505',borderBottom:'1px solid #050505',fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',fontSize:11,fontWeight:800,letterSpacing:'.1em'}}>
        <span>VORTEX // EXPERIMENTAL BUILD</span>
        <span>IN DEVELOPMENT // BEHAVIOR MAY CHANGE</span>
      </div>
      {children}
    </div>
  );
}
