#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parent
FILES=[ROOT/"index.html",ROOT/"404.html"]

STYLE=r"""
<style id="r937-ux-layer">
:root{--mt-safe-top:max(10px,env(safe-area-inset-top,0px));--mt-safe-bottom:max(10px,env(safe-area-inset-bottom,0px))}
button,input,[role="button"]{-webkit-tap-highlight-color:transparent}
button:focus-visible,input:focus-visible,[role="button"]:focus-visible{
  outline:2px solid color-mix(in srgb,var(--genre-accent,#6f8fa8) 58%,white);
  outline-offset:3px
}
.theme-atlas-row{content-visibility:auto;contain-intrinsic-size:78px}
.theme-atlas-track{
  display:flex!important;overflow-x:auto!important;overflow-y:hidden!important;
  scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important;
  scroll-snap-type:x proximity!important;overscroll-behavior-inline:contain!important;
  padding-inline:4px 20px!important;
}
.theme-atlas-track::-webkit-scrollbar{display:none!important}
.theme-shelf-item{
  scroll-snap-align:start!important;scroll-snap-stop:normal¥µÁ½ÉÑ¹Ðì(µ¥¸µ¡¥¡ÐèÐáÁà¥µÁ½ÉÑ¹ÐíÑ½Õ µÑ¥½¸éµ¹¥ÁÕ±Ñ¥½¸¥µÁ½ÉÑ¹Ð)ô(¹Ñ¡µµÑ±ÌµÉ½Üµ¡ÕÑÑ½¹íµ¥¸µ¡¥¡ÐèÌÁÁà¥µÁ½ÉÑ¹ÐíÑ½Õ µÑ¥½¸éµ¹¥ÁÕ±Ñ¥½¸¥µÁ½ÉÑ¹Ñô(¹Ñ¡µµÉ½ÕÀµ¥ÑµÍì(µÝ­¥Ðµ½ÙÉ±½ÜµÍÉ½±±¥¹éÑ½Õ ¥µÁ½ÉÑ¹Ðì(½ÙÉÍÉ½±°µ¡Ù¥½Èé½¹Ñ¥¸¥µÁ½ÉÑ¹Ðì(ÍÉ½±°µ¡Ù¥½ÈéÍµ½½Ñ ¥µÁ½ÉÑ¹Ðì)ô)¡Ñµ°¹µÐµÑ±ÌµÍÉ½±±¥¹¹Ñ¡µµÍ¡±ì(µÝ­¥Ðµ­É½Àµ¥±ÑÈé±ÕÈ áÁà¤ÍÑÕÉÑ ÄÀÐ¤¥µÁ½ÉÑ¹Ðì(­É½Àµ¥±ÑÈé±ÕÈ áÁà¤ÍÑÕÉÑ ÄÀÐ¤¥µÁ½ÉÑ¹Ðì(½àµÍ¡½ÜèÀÄÙÁàÐáÁàÉ ÌÈ°Ðà°Øà°¸ÄÈ¤¥µÁ½ÉÑ¹Ðì)ô(¹ÁÍÍ½½¬µÁ¹±íÁ¥¹µ½ÑÑ½´éÙÈ ´µµÐµÍµ½ÑÑ½´¤¥µÁ½ÉÑ¹Ñô(¹ÁÍÍ½½¬µÉ½ÕÍ±ì(ÍÉ½±°µÍ¹ÀµÑåÁéàµ¹Ñ½Éä¥µÁ½ÉÑ¹ÐíÍÉ½±°µ¡Ù¥½ÈéÍµ½½Ñ ¥µÁ½ÉÑ¹Ðì(½ÙÉÍÉ½±°µ¡Ù¥½Èµ¥¹±¥¹é½¹Ñ¥¸¥µÁ½ÉÑ¹Ðì)ô(¹ÁÍÍ½½¬µÉíÍÉ½±°µÍ¹Àµ±¥¸é¹ÑÈ¥µÁ½ÉÑ¹ÐíÍÉ½±°µÍ¹ÀµÍÑ½Àé±ÝåÌ¥µÁ½ÉÑ¹Ñô(¹ÁÍÍ½½¬µÁÉ½ÉÍÍì(¥ÍÁ±äé±àí±¥¸µ¥ÑµÌé¹ÑÈí©ÕÍÑ¥äµ½¹Ñ¹Ðé¹ÑÈíÀèÄÁÁàì(Á¥¹èÀÈÁÁàÄÉÁàí½±½ÈéÉ ÐÄ°ÜÀ°äÌ°¸Ðà¤ì(½¹ÐèÜØÀÙÁà¼ÄÙÈ ´µÉ½ÑÍ¬¤í±ÑÑÈµÍÁ¥¹è¸ÄÉ´)ô(¹ÁÍÍ½½¬µÁÉ½ÉÍÌÕÑÑ½¹ì(Ý¥Ñ èÌÙÁàí¡¥¡ÐèÌÙÁàí½ÉÈµÉ¥ÕÌèÔÀí½ÉÈèÅÁàÍ½±¥É ÐÄ°ÜÀ°äÌ°¸Àà¤ì(­É½Õ¹éÉ ÈÔÔ°ÈÔÔ°ÈÔÔ°¸Øà¤í½±½ÈèÈäÐØÕí¬splay:grid;place-items:center;
  font:760 13px/1 var(--grotesk);cursor:pointer
}
.passbook-progress b{min-width:72px;text-align:center;color:#29465d;font-size:6.2px}
.passbook-progress button:disabled{opacity:.26;cursor:default}
#audioAccessorySheet{padding:var(--mt-safe-top) max(10px,env(safe-area-inset-right,0px)) var(--mt-safe-bottom) max(10px,env(safe-area-inset-left,0px))!important}
#audioAccessorySheet .audio-accessory-card{
  position:relative!important;isolation:isolate!important;
  max-height:calc(var(--musicetown-visible-height,100dvh) - var(--mt-safe-top) - var(--mt-safe-bottom))aimportant;
  overflow:auto!important;-webkit-overflow-scrolling:touch!important
}
#audioAccessoryClose{
  position:sticky!important;float:right!important;top:10px!important;right:10px!important;
  left:auto!important;bottom:auto!important;margin:0 0 -42px auto!important;
  width:44px!important;height:44px!important;z-index:1002!important;
  transform:none!important;translate:none!important;flex:0 0 auto!important
}
.deck-seek,.glass-seek{
  -webkit-appearance:none!important;appearance:none!important;
  min-height:34px!important;height:34px!important;background:transparent!important;
  touch-action:pan-x!important;cursor:pointer!important
}
.deck-seek-::-webkit-slider-runnable-track,.glass-seek::