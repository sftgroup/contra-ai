// CONTRA — Wallet + Contracts (v2, dashboard-aware)
(function() {
  'use strict';
  let account = null, signer = null;
  window.__contra = { get account() { return account; }, get signer() { return signer; }, connectWallet: function() { return connectWallet(); } };
  const isDash = window.location.pathname.includes('dashboard');

  function shortAddr(a) { return a ? a.slice(0,6)+'...'+a.slice(-4) : ''; }

  function toast(msg, type) {
    // Try dashboard toast first
    let t = document.getElementById('toast');
    if (t) {
      document.getElementById('toastMsg').textContent = msg;
      t.classList.remove('hidden');
      setTimeout(function(){t.classList.add('hidden')}, 3000);
      return;
    }
    // Fallback
    t = document.getElementById('contra-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'contra-toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:12px;font-family:monospace;font-size:13px;transition:all 0.3s;pointer-events:none;max-width:90vw;text-align:center;background:rgba(17,17,24,0.95);color:#e0e0e0;border:1px solid rgba(255,255,255,0.1)';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._t); t._t = setTimeout(function(){t.style.opacity='0'},4000);
  }

  async function connectWallet() {
    if (!window.ethereum) { toast('Please install MetaMask', 'info'); return; }
    try {
      var accs = await window.ethereum.request({method:'eth_requestAccounts'});
      account = accs[0];
      signer = await (new ethers.BrowserProvider(window.ethereum)).getSigner();
      updateAll();
      toast('Connected: '+shortAddr(account), 'success');
    } catch(e) { if (e.code !== 4001) toast('Failed: '+e.message, 'error'); }
  }

  function disconnect() {
    account = null; signer = null;
    updateAll();
    toast('Disconnected', 'info');
  }
  window.connectWallet = connectWallet;
  window.disconnectWallet = disconnect;

  function updateAll() {
    var connected = !!account;
    var addr = shortAddr(account);

    // 1. Dashboard topbar: replace mock address with real one
    if (isDash) {
      var topbarAddr = document.querySelector('.jet.text-\\[\\#94a3b8\\]');
      if (topbarAddr) {
        topbarAddr.textContent = connected ? addr : 'Not Connected';
        topbarAddr.style.color = connected ? '#00ff88' : '#64748b';
      }
      var dot = document.querySelector('.w-2.h-2.rounded-full');
      if (dot) dot.style.background = connected ? '#22c55e' : '#ef4444';
    }

    // 2. All "Connect Wallet" buttons
    document.querySelectorAll('button, a').forEach(function(el) {
      var t = (el.textContent||'').trim();
      if (!t.includes('Connect Wallet') && !t.includes('Mint Now')) return;
      el.style.cursor = 'pointer';
      el.removeAttribute('href');
      if (connected) {
        el.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:6px;"></span>'+addr;
        el.onclick = function(e){e.preventDefault();disconnect();};
      } else {
        el.innerHTML = 'Connect Wallet';
        el.onclick = function(e){e.preventDefault();connectWallet();};
      }
    });

    // 3. Dashboard "Mint" buttons → require wallet
    if (isDash && connected) {
      document.querySelectorAll('button').forEach(function(b) {
        var t = (b.textContent||'').trim();
        if (t.startsWith('Mint ') && !b._hooked) {
          b._hooked = true;
          var orig = b.onclick;
          b.onclick = function(e) {
            if (!account) { connectWallet(); return; }
            toast('Minting '+t.replace('Mint ','')+'... check MetaMask', 'info');
            if (orig) orig.call(b);
          };
        }
      });
      // "Submit Proposal" and "Confirm Vote" also need wallet
      ['submitProposal','submitVote'].forEach(function(fn) {
        var origSubmit = window[fn];
        if (origSubmit && !origSubmit._hooked) {
          origSubmit._hooked = true;
          window[fn] = function() {
            if (!account) { connectWallet(); return; }
            origSubmit();
          };
        }
      });
    }

    // 4. Redirect "Mint Now" links
    document.querySelectorAll('a').forEach(function(a) {
      if ((a.textContent||'').trim()==='Mint Now' && connected) a.href='/mint';
    });
  }

  // INIT
  function init() {
    updateAll();
    if (isDash) {
      // Override dashboard switchTab to re-bind buttons after tab switch
      var origSwitchTab = window.switchTab;
      if (origSwitchTab) {
        window.switchTab = function(id) {
          origSwitchTab(id);
          setTimeout(updateAll, 100); // re-bind after DOM update
        };
      }
    }
    // === Mint + Approve Functions ===
  const USDC_ADDR = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const USDC_ABI = ["function approve(address spender, uint256 amount) external returns (bool)","function allowance(address owner, address spender) external view returns (uint256)"];
  const NFT_ABI = ["function mint() external","function safeMint() external","function balanceOf(address) view returns (uint256)","function tokenOfOwnerByIndex(address, uint256) view returns (uint256)","function totalSupply() view returns (uint256)"];

  window.approveUSDC = async function() {
    if (!account) { connectWallet(); return; }
    if (typeof selectedChain === "undefined" || !selectedChain) { toast("Please select a chain first", "error"); return; }
    if (typeof CHAIN_CONFIG === "undefined") { toast("Chain config not loaded", "error"); return; }
    var btn = document.getElementById("approveBtn");
    var status = document.getElementById("mintStatus");
    var err = document.getElementById("mintError");
    var stepMint = document.getElementById("stepMint");
    btn.disabled = true; btn.textContent = "Approving...";
    status.classList.remove("hidden"); status.textContent = "Requesting approval...";
    err.classList.add("hidden");
    try {
      var usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);
      var contractAddr = CHAIN_CONFIG[selectedChain].contract;
      var amount = ethers.parseUnits("10000", 6);
      var tx = await usdc.approve(contractAddr, amount);
      status.textContent = "Waiting for confirmation...";
      await tx.wait();
      status.textContent = "USDC approved!";
      btn.textContent = "Approved ✓";
      stepMint.style.opacity = "1";
      var mb = document.getElementById("mintBtn");
      mb.disabled = false;
      stepMint.querySelector("span").style.color = "#00e5ff";
      stepMint.querySelector(".font-bold").style.color = "#fff";
    } catch(e) {
      btn.disabled = false; btn.textContent = "Approve";
      status.classList.add("hidden");
      err.classList.remove("hidden"); err.textContent = "Approval failed: " + (e.reason || e.message);
    }
  };

  window.mintNFT = async function() {
    if (!account) { connectWallet(); return; }
    if (typeof selectedChain === "undefined" || !selectedChain) { toast("Please select a chain first", "error"); return; }
    var btn = document.getElementById("mintBtn");
    var status = document.getElementById("mintStatus");
    var err = document.getElementById("mintError");
    var success = document.getElementById("mintSuccess");
    btn.disabled = true; btn.textContent = "Minting...";
    status.classList.remove("hidden"); status.textContent = "Sending mint transaction...";
    err.classList.add("hidden");
    try {
      var nft = new ethers.Contract(CHAIN_CONFIG[selectedChain].contract, NFT_ABI, signer);
      var tx = await nft.mint();
      status.textContent = "Waiting for confirmation...";
      var receipt = await tx.wait();
      var tokenId = "?";
      for (var i = 0; i < (receipt.logs||[]).length; i++) {
        try {
          var d = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], receipt.logs[i].data);
          if (d && d[0]) { tokenId = d[0].toString(); break; }
        } catch(_) {}
      }
      status.classList.add("hidden");
      success.classList.remove("hidden");
      document.getElementById("successChain").textContent = selectedChain.toUpperCase();
      document.getElementById("successTokenId").textContent = tokenId;
      document.getElementById("successExplorer").href = (CHAIN_CONFIG[selectedChain].explorer||"#") + "/tx/" + tx.hash;
      btn.textContent = "Mint Again";
      btn.disabled = false;
    } catch(e) {
      btn.disabled = false; btn.textContent = "Mint";
      status.classList.add("hidden");
      err.classList.remove("hidden"); err.textContent = "Mint failed: " + (e.reason || e.message);
    }
  };

// Auto-reconnect
    if (window.ethereum) {
      setTimeout(async function() {
        try {
          var a = await window.ethereum.request({method:'eth_accounts'});
          if (a.length > 0) { account = a[0]; updateAll(); }
        } catch(e) {}
      }, 500);
      window.ethereum.on('accountsChanged', function(a) {
        account = a.length ? a[0] : null; updateAll();
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
