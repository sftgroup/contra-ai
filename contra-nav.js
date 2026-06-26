// CONTRA Navigation — injected bar with all page links
(function() {
  // Hide original nav-blur immediately (before it renders)
  var style = document.createElement('style');
  style.textContent = '.nav-blur{display:none!important}';
  document.head.appendChild(style);

  var nav = document.createElement('nav');
  nav.innerHTML = '<div style="max-width:1280px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;"><a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;"><div style="width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#00e5ff,#a855f7);display:flex;align-items:center;justify-content:center;"><span style="font-family:Orbitron,monospace;color:#fff;font-weight:700;font-size:12px;">C</span></div><span style="font-family:Orbitron,monospace;font-weight:700;font-size:16px;color:#fff;">CONTRA</span></a><div style="display:flex;align-items:center;gap:18px;font-family:JetBrains Mono,monospace;font-size:12px;"><a href="/" class="nav-a" style="color:#94a3b8;text-decoration:none;">Home</a><a href="/mint" class="nav-a" style="color:#94a3b8;text-decoration:none;">Mint</a><a href="/dashboard" class="nav-a" style="color:#94a3b8;text-decoration:none;">Dashboard</a><a href="/about" class="nav-a" style="color:#94a3b8;text-decoration:none;">About</a><a href="/whitepaper" class="nav-a" style="color:#94a3b8;text-decoration:none;">Whitepaper</a><button class="wallet-btn" style="padding:6px 18px;border-radius:99px;font-family:JetBrains Mono,monospace;font-size:12px;color:#00e5ff;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.25);cursor:pointer;">Connect Wallet</button></div></div>';
  nav.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:99;background:rgba(10,10,15,0.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,0.06);';
  document.body.insertBefore(nav, document.body.firstChild);

  // Highlight current page
  var p = window.location.pathname.replace(/\/$/,'')||'/';
  nav.querySelectorAll('.nav-a').forEach(function(a) {
    if (a.getAttribute('href')===p) a.style.color = '#00e5ff';
  });

  // Fix body padding
  document.body.style.paddingTop = '64px';
})();
