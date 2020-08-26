let mobileMenuVisible=false;const toggleMobileMenu=()=>{let mobileMenu=document.getElementById('mobile-menu');if(mobileMenuVisible==false){mobileMenu.style.animationName='bounceInRight';mobileMenu.style.webkitAnimationName='bounceInRight';mobileMenu.style.display='block';mobileMenuVisible=true;}else{mobileMenu.style.animationName='bounceOutRight';mobileMenu.style.webkitAnimationName='bounceOutRight'
mobileMenuVisible=false;}}
let menu=document.getElementById("menu-btn")
if(menu!==null){menu.addEventListener("click",toggleMobileMenu)}
let nav=document.getElementById("TableOfContents")
if(nav!==null){var section=document.querySelectorAll("article h2, article h3")
var sections={}
Array.prototype.forEach.call(section,function(e){sections[e.id]=e.offsetTop})
window.onscroll=function(){var scrollPosition=document.documentElement.scrollTop||document.body.scrollTop
var currentActive=null
for(i in sections){if(sections[i]<=scrollPosition){currentActive=i}else{break;}}
var activelink=document.querySelector('#TableOfContents a.active')
if(activelink!==null){document.querySelector('#TableOfContents a.active').classList.remove('active')}
document.querySelector('a[href*='+currentActive+']').classList.add('active')
console.log('a[href*='+currentActive+'] adding active class')}};(function(){'use strict';if(!document.queryCommandSupported('copy')){return;}
function flashCopyMessage(el,msg){el.textContent=msg;setTimeout(function(){el.textContent="Copy";},1000);}
function selectText(node){var selection=window.getSelection();var range=document.createRange();range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);return selection;}
function addCopyButton(containerEl){var copyBtn=document.createElement("button");copyBtn.className="highlight-copy-btn";copyBtn.textContent="Copy";var codeEl=containerEl.firstElementChild;copyBtn.addEventListener('click',function(){try{var selection=selectText(codeEl);document.execCommand('copy');selection.removeAllRanges();flashCopyMessage(copyBtn,'Copied!')}catch(e){console&&console.log(e);flashCopyMessage(copyBtn,'Failed :\'(')}});containerEl.appendChild(copyBtn);}
var highlightBlocks=document.getElementsByClassName('highlight');Array.prototype.forEach.call(highlightBlocks,addCopyButton);})();