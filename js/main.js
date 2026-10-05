const themeButton=document.querySelector('#theme-toggle');
function applyTheme(theme){
 document.documentElement.dataset.theme=theme;
 const dark=theme==='dark';
 const label=dark?'Switch to light theme':'Switch to dark theme';
 themeButton.setAttribute('aria-label',label);
 themeButton.setAttribute('title',label);
 themeButton.setAttribute('aria-pressed',String(dark));
}
applyTheme(document.documentElement.dataset.theme||'dark');
themeButton.hidden=false;
themeButton.addEventListener('click',()=>{
 const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
 applyTheme(theme);
 try{localStorage.setItem('insu-theme',theme);}catch{}
});
const papers=Array.from(document.querySelectorAll('#publication-list .publication'));
const viewButtons=Array.from(document.querySelectorAll('[data-publication-view]'));
const groups=Array.from(document.querySelectorAll('.publication-group'));
// Edit data-selected on each paper to curate the selected view without duplicating content.
function setPublicationView(view){
 const selected=view==='selected';
 papers.forEach(paper=>{paper.hidden=selected&&paper.dataset.selected!=='true';paper.removeAttribute('data-last-visible');});
 groups.forEach(group=>{
  const visible=Array.from(group.querySelectorAll('.publication')).filter(paper=>!paper.hidden);
  group.hidden=visible.length===0;
  group.querySelector('[data-publication-heading]').hidden=selected;
  if(visible.length)visible[visible.length-1].setAttribute('data-last-visible','');
 });
 viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.publicationView===view)));
 const count=papers.filter(paper=>!paper.hidden).length;
 document.querySelector('#publication-status').textContent=selected?count+' selected publications':count+' publications · conference papers and preprints';
}
viewButtons.forEach(button=>button.addEventListener('click',()=>setPublicationView(button.dataset.publicationView)));
setPublicationView('selected');
document.querySelector('#publication-controls').hidden=false;
