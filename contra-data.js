// CONTRA Data Bridge — fetch live stats from relay API
(function() {
  'use strict';
  var API = 'http://43.159.39.85:3001/api';
  var onHome = window.location.pathname === '/' || window.location.pathname === '';

  if (!onHome) return;

  // Update total minted / holders on homepage from live data
  fetch(API + '/stats').then(function(r){return r.json()}).then(function(d) {
    // Update Total Minted
    var el = document.querySelector('.font-display.font-bold.text-white');
    if (el && el.parentElement && el.parentElement.textContent.includes('Total Minted')) {
      el.textContent = d.totalMinted || 0;
    }
    // Update chain progress bars
    if (d.byChain) {
      ['base','bsc','eth','solana'].forEach(function(chain) {
        var card = document.querySelector('[data-chain="'+chain+'"]');
        if (card) {
          var minted = d.byChain[chain] || 0;
          var max = d.maxSupplyByChain[chain] || 100;
          var pct = Math.min(100, Math.round(minted / max * 100));
          var bar = card.querySelector('.h-1\\.5.rounded-full:not(.bg-white\\/5)');
          if (bar) bar.style.width = pct + '%';
          var stats = card.querySelectorAll('span.font-mono');
          if (stats.length >= 2) {
            stats[stats.length-2].textContent = minted + ' / ' + max;
            stats[stats.length-1].textContent = pct + '%';
          }
        }
      });
    }
  }).catch(function(){});
})();
