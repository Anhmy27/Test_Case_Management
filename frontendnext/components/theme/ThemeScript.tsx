export function ThemeScript() {
  const script = `(function(){try{var k='tcm_theme',t=localStorage.getItem(k),d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches),r=document.documentElement;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
