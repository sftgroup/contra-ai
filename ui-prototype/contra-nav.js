// CONTRA Navigation — injected bar with all page links
(function() {
  // Hide original nav-blur immediately (before it renders)
  var style = document.createElement('style');
  style.textContent = '.nav-blur{display:none!important}';
  document.head.appendChild(style);

  var nav = document.createElement('nav');
  nav.innerHTML = '<div style="max-width:1400px;margin:0 auto;padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between;"><a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;"><div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#00e5ff,#a855f7);display:flex;align-items:center;justify-content:center;"><span style="font-family:Orbitron,monospace;color:#fff;font-weight:700;font-size:14px;">C</span></div><span style="font-family:Orbitron,monospace;font-weight:700;font-size:18px;color:#fff;">Contra Ai</span></a><div style="display:flex;align-items:center;gap:24px;font-family:JetBrains Mono,monospace;font-size:13px;"><a href="/" class="nav-a" style="color:#94a3b8;text-decoration:none;">Home</a><a href="/mint" class="nav-a" style="color:#94a3b8;text-decoration:none;">Mint</a><a href="/dashboard" class="nav-a" style="color:#94a3b8;text-decoration:none;">Dashboard</a><a href="/about" class="nav-a" style="color:#94a3b8;text-decoration:none;">About</a><a href="/whitepaper" class="nav-a" style="color:#94a3b8;text-decoration:none;">Whitepaper</a><button class="wallet-btn" style="padding:8px 22px;border-radius:99px;font-family:JetBrains Mono,monospace;font-size:13px;color:#00e5ff;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.25);cursor:pointer;">Connect Wallet</button></div></div>';
  nav.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:99;background:rgba(10,10,15,0.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,0.06);';
  document.body.insertBefore(nav, document.body.firstChild);
  // Bind wallet button
  setTimeout(function(){
    var wb = document.querySelector(".wallet-btn");
    if (wb) {
      wb.onclick = function(e){ e.preventDefault(); if (typeof connectWallet === "function") connectWallet(); };
    }
  }, 0);

  // Highlight current page
  var p = window.location.pathname.replace(/\/$/,'')||'/';
  nav.querySelectorAll('.nav-a').forEach(function(a) {
    if (a.getAttribute('href')===p) a.style.color = '#00e5ff';
  });

  // Fix body padding
  document.body.style.paddingTop = '64px';
// Mobile hamburger
(function(){
  var btn = document.createElement("button");
  btn.id = "mobileMenuBtn";
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  btn.style.cssText = "display:none;background:none;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 8px;color:#94a3b8;cursor:pointer;line-height:0";

  // Insert after the nav container's inner div
  var navDiv = document.querySelector("nav > div");
  if (navDiv) {
    var links = navDiv.querySelector("div");
    if (links) {
      links.style.cssText += ";overflow:hidden;transition:max-height 0.3s";
      navDiv.appendChild(btn);
      btn.style.display = "";
      btn.onclick = function(){
        var isOpen = links.style.maxHeight && links.style.maxHeight !== "0px";
        links.style.maxHeight = isOpen ? "0px" : "500px";
        btn.innerHTML = isOpen ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      };
    }
  }

  // Responsive nav behavior
  var mq = window.matchMedia("(max-width: 768px)");
  function handleResize(e){
    var navDiv = document.querySelector("nav > div");
    var links = navDiv ? navDiv.querySelector("div") : null;
    var btn = document.getElementById("mobileMenuBtn");
    if (e.matches) {
      if (btn) btn.style.display = "";
      if (links) { links.style.flexDirection = "column"; links.style.maxHeight = "0px"; links.style.width = "100%"; }
    } else {
      if (btn) btn.style.display = "none";
      if (links) { links.style.flexDirection = ""; links.style.maxHeight = ""; links.style.width = ""; }
    }
  }
  mq.addEventListener("change", handleResize);
  handleResize(mq);

  // Re-initialize on wallet connect (nav might re-render)
  var origUpdate = window.updateAll;
  if (origUpdate) {
    window.updateAll = function(){
      origUpdate.apply(this, arguments);
      // Re-apply mobile nav after wallet button re-render
      setTimeout(function(){ handleResize(mq); }, 200);
    };
  }
})();

})();
