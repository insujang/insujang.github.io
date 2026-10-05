(function(){
 let saved;
 try{saved=localStorage.getItem('insu-theme');}catch{}
 document.documentElement.dataset.theme=saved==='light'||saved==='dark'?saved:'dark';
})();
