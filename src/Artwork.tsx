export function Wheel({ running, motion }: {running: boolean; motion: boolean}) {
  return <svg className={`wheel-art ${running && motion?'running':''} ${motion?'animate':''}`} viewBox="0 0 620 390" role="img" aria-label={running?'An illustrated hamster running in a wheel':'An illustrated hamster resting in a wheel'}>
    <defs>
      <pattern id="scene-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#263322" strokeWidth="1"/></pattern>
      <radialGradient id="scene-light"><stop stopColor="#314526" stopOpacity=".65"/><stop offset="1" stopColor="#19231a" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="620" height="390" fill="url(#scene-grid)"/>
    <ellipse cx="310" cy="190" rx="270" ry="190" fill="url(#scene-light)"/>
    <path d="M32 337H588M62 349h45m406 0h45" stroke="#425137" strokeWidth="1.5"/>
    <ellipse cx="310" cy="336" rx="146" ry="12" fill="#101810"/>
    <path d="M310 187 248 334h124z" fill="#1b291b" stroke="#617549" strokeWidth="3"/>
    <path d="M236 336h149" stroke="#c0df77" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="310" cy="178" r="147" fill="#172016" stroke="#dcff78" strokeWidth="4"/>
    <circle cx="310" cy="178" r="136" fill="none" stroke="#758d48" strokeWidth="2"/>
    <g className="wheel-spokes">
      {Array.from({length:12},(_,i)=><path key={i} d="M310 178v-133" transform={`rotate(${i*30} 310 178)`} stroke="#62773d" strokeWidth="2"/>)}
      <circle cx="310" cy="178" r="142" fill="none" stroke="#dcff78" strokeWidth="2" strokeDasharray="3 21"/>
    </g>
    <circle cx="310" cy="178" r="13" fill="#dcff78"/><circle cx="310" cy="178" r="5" fill="#62773d"/>
    <g className="hamster">
      <path d="M269 282q-23-17-28 0" fill="none" stroke="#ffcba2" strokeWidth="8" strokeLinecap="round"/>
      <ellipse cx="304" cy="280" rx="48" ry="30" fill="#e99664"/>
      <path d="M267 281q14-24 36-21 38 2 43 28-10 24-39 20-26 3-40-27" fill="#ffb27c"/>
      <ellipse cx="315" cy="291" rx="28" ry="18" fill="#ffdbc0"/>
      <circle cx="337" cy="266" r="26" fill="#ffb27c"/>
      <circle cx="326" cy="244" r="13" fill="#ffb27c"/><circle cx="326" cy="244" r="7" fill="#db8365"/>
      <circle cx="352" cy="260" r="4" fill="#19231a"/><circle cx="353" cy="259" r="1" fill="#f0f3e9"/>
      <ellipse cx="360" cy="273" rx="10" ry="8" fill="#ffdbc0"/>
      <circle cx="368" cy="270" r="3" fill="#7e4937"/>
      <path d="m354 279 12 3m-11-1 9 7" stroke="#ac6a4f" strokeWidth="1.5" strokeLinecap="round"/>
      <path className="paw front" d="m333 299 18 6m-58-3-15 5" stroke="#ffd1b1" strokeWidth="8" strokeLinecap="round"/>
      <path className="paw back" d="m319 304 13 5m-54-11-12 4" stroke="#e99664" strokeWidth="7" strokeLinecap="round"/>
    </g>
    <g fill="none" stroke="#819660" strokeWidth="1.5"><path d="M90 111h38m-19-19v38M476 242h24m-12-12v24"/><circle cx="484" cy="97" r="4"/><circle cx="154" cy="267" r="3"/></g>
    <g fill="#dcff78"><circle cx="133" cy="170" r="2"/><circle cx="441" cy="283" r="2"/><circle cx="411" cy="52" r="2"/></g>
  </svg>;
}
export function Vacuum({ hp }: {hp: number}) {
  return <svg className="vacuum-art" viewBox="0 0 160 130" role="img" aria-label={`Vacuum of the Void with ${hp} health`}>
    <path d="M104 69q30-5 28-30T101 19q-15 8 2 21" fill="none" stroke="#8b9685" strokeWidth="9" strokeLinecap="round"/>
    <path d="m102 38-14 5 9 17 17-7z" fill="#a9b49f"/>
    <path d="M31 79q0-34 39-34t39 34v24H31z" fill="#48543e" stroke="#94a282" strokeWidth="2"/>
    <path d="M34 77h72v25H34z" fill="#384531"/>
    <path d="m45 65 17 5m14 0 17-5" stroke="#ffb27c" strokeWidth="4" strokeLinecap="round"/>
    <path d="M58 88h24" stroke="#101810" strokeWidth="5" strokeLinecap="round"/>
    <path d="M25 98h92v11H25z" fill="#8b9685"/><rect x="41" y="109" width="15" height="10" rx="4" fill="#101810"/><rect x="88" y="109" width="15" height="10" rx="4" fill="#101810"/>
    <path d="M63 47v-8h15v8" fill="none" stroke="#8b9685" strokeWidth="4"/>
  </svg>;
}
export function Icon({name}:{name:'sound'|'mute'|'help'|'arrow'|'download'|'pause'|'play'|'close'|'spark'|'wheel'}){
  const paths: Record<string, React.ReactNode>={
    sound:<><path d="m10 4-5 4H2v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute:<><path d="m10 4-5 4H2v8h3l5 4zM16 9l6 6m0-6-6 6"/></>,
    help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .4-1 1.2-1 2M12 17v.1"/></>,
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
    download:<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>,
    pause:<><path d="M8 5v14M16 5v14"/></>, play:<path d="m7 4 13 8-13 8z"/>,
    close:<path d="m6 6 12 12m0-12L6 18"/>,
    spark:<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>,
    wheel:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7m0 4v7M3 12h7m4 0h7M5.5 5.5l5 5m3 3 5 5m0-13-5 5m-3 3-5 5"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
