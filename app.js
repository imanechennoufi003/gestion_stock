/* =========================
   Gestion Stock
   - PHP/MySQL Backend via fetch API
   - Login/Register via api/auth.php
   - Produits, Clients, Fournisseurs, Commandes via PHP API
   ========================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const money = (n) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

// LocalStorage helpers (cache uniquement)
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }
function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
}

function nowDateTime() {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return {
        date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        iso: d.toISOString()
    };
}

function sanitizeText(s) { return String(s ?? "").replace(/[<>]/g, ""); }

async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

/* =========================
   API FETCH HELPER
   ========================= */
async function apiFetch(url, body = null) {
    const opts = { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (body !== null) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    else { opts.method = 'GET'; }
    try {
        const res = await fetch(url, opts);
        const json = await res.json();
        return json;
    } catch (e) {
        console.error('apiFetch error', url, e);
        return { success: false, msg: 'Erreur réseau.' };
    }
}

/* =========================
   STATE
   ========================= */
let state = {
    session: null,
    products: [],
    cart: load('gs_cart', []),
    orders: [],
    clients: [],
    suppliers: []
};

/* Normalise un produit venant de l'API PHP vers le format attendu par le JS */
function normalizeProduct(p) {
    return {
        id: String(p.id),
        name: p.name,
        category: (p.category || 'AUTRE').toUpperCase(),
        price: Number(p.price),
        stock: Number(p.stock),
        desc: p.description || p.desc || '',
        img: p.img_url || p.img || '',
        popular: !!p.popular
    };
}
function normalizeClient(c) {
    return { id: String(c.id), name: c.name, email: c.email || '', phone: c.phone || '', city: c.city || '', status: c.status || 'Actif' };
}
function normalizeSupplier(s) {
    return { id: String(s.id), name: s.name, category: (s.category || '').toUpperCase(), contact: s.contact || '', phone: s.phone || '' };
}

async function loadAllData() {
    const [pRes, cRes, sRes] = await Promise.all([
        apiFetch('api/products.php'),
        apiFetch('api/clients.php'),
        apiFetch('api/suppliers.php')
    ]);
    if (pRes.success) state.products = (pRes.data || []).map(normalizeProduct);
    if (cRes.success) state.clients = (cRes.data || []).map(normalizeClient);
    if (sRes.success) state.suppliers = (sRes.data || []).map(normalizeSupplier);
}

/* =========================
   AUTH
   ========================= */
const loginPage  = $("#loginPage");
const appPage    = $("#appPage");
const authWrapper = $("#authWrapper");

async function showApp() {
    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");
    const displayUser = (state.session?.username || state.session?.user || "USER").toUpperCase();
    $("#sessionUser").textContent = displayUser;
    $("#topUser").textContent     = displayUser;
    $("#billName").value          = displayUser;
    await loadAllData();
    refreshAll();
}

function showLogin() {
    appPage.classList.add("hidden");
    loginPage.classList.remove("hidden");
}

function setLoginMsg(msg, isErr) {
    if (isErr === undefined) isErr = true;
    const el = $("#loginMsg");
    if (el) { el.textContent = msg; el.style.color = isErr ? "#f87171" : "#4ade80"; }
}
function setSignupMsg(msg, isErr) {
    if (isErr === undefined) isErr = true;
    const el = $("#signupMsg");
    if (el) { el.textContent = msg; el.style.color = isErr ? "#f87171" : "#4ade80"; }
}

/* Toggle SignUp / SignIn */
document.addEventListener("click", (e) => {
    if (e.target.closest(".register-trigger")) { e.preventDefault(); authWrapper?.classList.add("toggled"); }
    if (e.target.closest(".login-trigger"))    { e.preventDefault(); authWrapper?.classList.remove("toggled"); }
});

/* Login submit */
$("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = ($("#loginUser").value || "").trim();
    const password = ($("#loginPass").value || "").trim();
    if (!username || !password) { setLoginMsg("Remplis tous les champs."); return; }
    setLoginMsg("Connexion...", false);
    const res = await apiFetch("api/auth.php?action=login", { username, password });
    if (res.success) {
        state.session = res.data;
        showApp();
    } else {
        setLoginMsg(res.msg || "Identifiants incorrects.");
    }
});

/* Signup submit */
$("#signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = ($("#signupUser").value || "").trim();
    const email    = ($("#signupEmail").value || "").trim();
    const password = ($("#signupPass").value || "").trim();
    if (!username || !password) { setSignupMsg("Username et mot de passe requis."); return; }
    setSignupMsg("Creation du compte...", false);
    const res = await apiFetch("api/auth.php?action=register", { username, email, password });
    if (res.success) {
        state.session = res.data;
        setSignupMsg("Compte cree avec succes !", false);
        setTimeout(() => showApp(), 600);
    } else {
        setSignupMsg(res.msg || "Erreur inscription.");
    }
});

async function doLogout() {
    await apiFetch("api/auth.php?action=logout", {});
    state.session = null;
    state.products = []; state.clients = []; state.suppliers = []; state.orders = []; state.cart = [];
    showLogin();
}
$("#btnLogout").addEventListener("click",    doLogout);
$("#btnLogoutTop").addEventListener("click", doLogout);

/* =========================
   NAVIGATION
   ========================= */
const navItems = $$(".nav-item");
const pages = {
    dashboard: $("#page-dashboard"),
    clients: $("#page-clients"),
    suppliers: $("#page-suppliers"),
    products: $("#page-products"),
    categories: $("#page-categories"),
    cashier: $("#page-cashier"),
    diagramme: $("#page-diagramme")
};
const pageTitle = $("#pageTitle");

function setActiveNav(key) {
    navItems.forEach(b => b.classList.toggle("active", b.dataset.page === key));
    Object.entries(pages).forEach(([k, el]) => {
        el.classList.toggle("hidden", k !== key);
    });

    const titles = {
        dashboard: "Dashboard",
        clients: "Clients",
        suppliers: "Fournisseurs",
        products: "Gestion des Produits",
        categories: "Cat\u00e9gories",
        cashier: "Caisse",
        diagramme: "Diagramme & Statistiques"
    };
    pageTitle.textContent = titles[key] || "Gestion Stock";
}

navItems.forEach(btn => {
    btn.addEventListener("click", () => {
        const p = btn.dataset.page;
        setActiveNav(p);
        if (p === "products") renderProducts();
        if (p === "cashier") renderCart();
        if (p === "categories") renderCategories();
        if (p === "dashboard") renderDashboard();
        if (p === "clients") renderClients();
        if (p === "suppliers") renderSuppliers();
        if (p === "diagramme") renderDiagramme();
    });
});

/* =========================
   PRODUCTS
   ========================= */
const productsGrid = $("#productsGrid");
const searchInput = $("#searchInput");
const categoryFilter = $("#categoryFilter");
const priceRange = $("#priceRange");
const priceMaxLabel = $("#priceMaxLabel");

function normalizeCategory(s) {
    return sanitizeText(s).trim().toUpperCase() || "AUTRE";
}

function getCategories() {
    const set = new Set((state.products || []).map(p => normalizeCategory(p.category)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function refreshCategoryFilter() {
    const cats = getCategories();
    const current = categoryFilter.value || "all";
    categoryFilter.innerHTML = `<option value="all">Toutes les catÃ©gories</option>` +
        cats.map(c => `<option value="${c}">${c}</option>`).join("");

    if ([...categoryFilter.options].some(o => o.value === current)) {
        categoryFilter.value = current;
    }
}

function productMatches(p) {
    const q = (searchInput.value || "").trim().toLowerCase();
    const cat = categoryFilter.value || "all";
    const maxP = Number(priceRange.value || 2000);

    const inSearch = !q || (p.name.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q));
    const inCat = (cat === "all") || (normalizeCategory(p.category) === cat);
    const inPrice = Number(p.price) <= maxP;

    return inSearch && inCat && inPrice;
}

function renderProducts() {
    refreshCategoryFilter();
    priceMaxLabel.textContent = priceRange.value;

    const list = (state.products || []).filter(productMatches);

    productsGrid.innerHTML = list.map(p => {
        const cat = normalizeCategory(p.category);
        const tag = p.popular ? `<div class="tag">Populaire</div>` : "";
        return `
      <div class="card">
        <div class="card-top">
          ${tag}
          <img src="${p.img}" alt="${sanitizeText(p.name)}" loading="lazy">
        </div>
        <div class="card-body">
          <div class="cat">${cat}</div>
          <div class="name">${sanitizeText(p.name)}</div>
          <p class="desc">${sanitizeText(p.desc || "")}</p>
          <div class="row">
            <div class="price">${money(p.price)} DH</div>
            <div class="stock">Stock: <b>${p.stock}</b></div>
          </div>
          <div class="card-actions">
            <button class="btn-mini primary" data-add="${p.id}">
              <i class="fa-solid fa-cart-plus"></i> Ajouter
            </button>
            <button class="btn-mini warning" data-edit-prod="${p.id}">
              <i class="fa-solid fa-pen"></i> Modifier
            </button>
            <button class="btn-mini" data-del="${p.id}">
              <i class="fa-solid fa-trash"></i> Suppr.
            </button>
          </div>
        </div>
      </div>
    `;
    }).join("");

    $$("[data-add]").forEach(btn => {
        btn.addEventListener("click", () => {
            addToCart(btn.dataset.add);
            alert("AjoutÃ© au panier âœ…");
        });
    });

    $$("[data-del]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.del;
            if (confirm("Supprimer ce produit ?")) {
                const res = await apiFetch('api/products.php?action=delete', { id: Number(id) || id });
                if (res.success) {
                    state.products = state.products.filter(x => x.id !== id);
                    state.cart = state.cart.filter(c => c.productId !== id);
                    save('gs_cart', state.cart);
                    await syncCart();
                    refreshAll();
                } else { alert(res.msg || 'Erreur suppression.'); }
            }
        });
    });

    $$("[data-edit-prod]").forEach(btn => {
        btn.addEventListener("click", () => {
            openEditProductModal(btn.dataset.editProd);
        });
    });
}

searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
priceRange.addEventListener("input", renderProducts);

/* =========================
   ADD PRODUCT MODAL
   ========================= */
const modalAdd = $("#modalAdd");
const btnOpenAdd = $("#btnOpenAdd");
const btnCloseAdd = $("#btnCloseAdd");
const btnCancelAdd = $("#btnCancelAdd");
const btnSaveProduct = $("#btnSaveProduct");

const pName = $("#pName");
const pCat = $("#pCat");
const pPrice = $("#pPrice");
const pStock = $("#pStock");
const pDesc = $("#pDesc");
const pImgFile = $("#pImgFile");
const pImgUrl = $("#pImgUrl");
const pPreview = $("#pPreview");
const imgTabs = $$("#modalAdd .tab");
const imgTabUpload = $("#imgTabUpload");
const imgTabUrl = $("#imgTabUrl");

function openAddModal() {
    modalAdd.classList.remove("hidden");
    pName.value = "";
    pCat.value = "";
    pPrice.value = "";
    pStock.value = "";
    pDesc.value = "";
    pImgFile.value = "";
    pImgUrl.value = "";
    pPreview.src = "";
    setImgTab("upload");
}
function closeAddModal() { modalAdd.classList.add("hidden"); }

btnOpenAdd.addEventListener("click", openAddModal);
btnCloseAdd.addEventListener("click", closeAddModal);
btnCancelAdd.addEventListener("click", closeAddModal);

function setImgTab(which) {
    imgTabs.forEach(t => t.classList.toggle("active", t.dataset.imgtab === which));
    imgTabUpload.classList.toggle("hidden", which !== "upload");
    imgTabUrl.classList.toggle("hidden", which !== "url");
}
imgTabs.forEach(t => t.addEventListener("click", () => setImgTab(t.dataset.imgtab)));

pImgFile.addEventListener("change", async () => {
    const file = pImgFile.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    pPreview.src = dataUrl;
});

pImgUrl.addEventListener("input", () => {
    const url = (pImgUrl.value || "").trim();
    if (url) pPreview.src = url;
});

btnSaveProduct.addEventListener("click", async () => {
    const name = sanitizeText(pName.value).trim();
    const cat = normalizeCategory(pCat.value);
    const price = Number(pPrice.value);
    const stock = Number(pStock.value);
    const desc = sanitizeText(pDesc.value).trim();

    if (!name || !cat || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
        alert("Remplis: Nom, Catégorie, Prix, Stock (valeurs valides).");
        return;
    }

    let img = "";
    if (pPreview.src && pPreview.src.startsWith("data:")) img = pPreview.src;
    else if (pPreview.src && /^https?:\/\//i.test(pPreview.src)) img = pPreview.src;
    if (!img) img = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60";

    const res = await apiFetch('api/products.php?action=add', {
        name, category: cat, price, stock, description: desc, img_url: img, popular: 1
    });
    if (res.success) {
        state.products.unshift(normalizeProduct({ ...res.data, description: desc, img_url: img }));
        closeAddModal();
        refreshAll();
    } else { alert(res.msg || 'Erreur ajout produit.'); }
});

/* =========================
   CART
   ========================= */
const cartList = $("#cartList");
const cartSubtotal = $("#cartSubtotal");
const btnClearCart = $("#btnClearCart");
const btnCheckout = $("#btnCheckout");
const lastTicketWrap = $("#lastTicketWrap");

function addToCart(productId) {
    const p = state.products.find(x => x.id === productId);
    if (!p) return;
    if (p.stock <= 0) { alert("Stock épuisé."); return; }
    const item = state.cart.find(c => c.productId === productId);
    if (item) {
        if (item.qty + 1 > p.stock) { alert("Quantité > stock."); return; }
        item.qty += 1;
    } else {
        state.cart.push({ productId, qty: 1 });
    }
    save('gs_cart', state.cart);
    syncCart();
    renderCart();
    renderDashboard();
}

function cartItemsDetailed() {
    return state.cart.map(c => {
        const p = state.products.find(x => x.id === c.productId);
        return p ? { ...c, product: p, lineTotal: Number(p.price) * Number(c.qty) } : null;
    }).filter(Boolean);
}

function cartSubtotalValue() {
    return cartItemsDetailed().reduce((s, it) => s + it.lineTotal, 0);
}

function renderCart() {
    const items = cartItemsDetailed();
    if (!items.length) {
        cartList.innerHTML = `<div class="muted">Panier vide.</div>`;
        cartSubtotal.textContent = `0.00 DH`;
        return;
    }

    cartList.innerHTML = items.map(it => {
        const p = it.product;
        return `
      <div class="cart-item">
        <img src="${p.img}" alt="${sanitizeText(p.name)}">
        <div class="cart-mid">
          <div class="cart-name">${sanitizeText(p.name)}</div>
          <div class="cart-sub">${normalizeCategory(p.category)} â€¢ ${money(p.price)} DH</div>
        </div>
        <div class="qty">
          <button data-minus="${p.id}">-</button>
          <span>${it.qty}</span>
          <button data-plus="${p.id}">+</button>
        </div>
        <div class="cart-price">${money(it.lineTotal)} DH</div>
      </div>
    `;
    }).join("");

    cartSubtotal.textContent = `${money(cartSubtotalValue())} DH`;

    $$("[data-minus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.minus, -1)));
    $$("[data-plus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.plus, +1)));
}

async function syncCart() {
    if (!state.session) return;
    await apiFetch('api/cart.php?action=sync', { cart: state.cart });
}

function changeQty(productId, delta) {
    const p = state.products.find(x => x.id === productId);
    const item = state.cart.find(c => c.productId === productId);
    if (!p || !item) return;
    const next = item.qty + delta;
    if (next <= 0) {
        state.cart = state.cart.filter(c => c.productId !== productId);
    } else {
        if (next > p.stock) { alert("Quantité > stock."); return; }
        item.qty = next;
    }
    save('gs_cart', state.cart);
    syncCart();
    renderCart();
}

btnClearCart.addEventListener("click", async () => {
    if (!state.cart.length) return;
    if (confirm("Vider le panier ?")) {
        state.cart = [];
        save('gs_cart', state.cart);
        await apiFetch('api/cart.php?action=clear', {});
        renderCart();
    }
});

/* =========================
   PAYMENT
   ========================= */
const modalPay = $("#modalPay");
const btnClosePay = $("#btnClosePay");
const btnPayNow = $("#btnPayNow");

const cardNumber = $("#cardNumber");
const expMonth = $("#expMonth");
const expYear = $("#expYear");
const cardCvv = $("#cardCvv");

const billName = $("#billName");
const billCountry = $("#billCountry");
const billCity = $("#billCity");
const billAddr = $("#billAddr");

// Preview
const pvNumber = $("#pvNumber");
const pvHolder = $("#pvHolder");
const pvExp = $("#pvExp");

function openPayModal() {
    if (!state.cart.length) {
        alert("Panier vide.");
        return;
    }
    modalPay.classList.remove("hidden");
}
function closePayModal() { modalPay.classList.add("hidden"); }

btnCheckout.addEventListener("click", openPayModal);
btnClosePay.addEventListener("click", closePayModal);

(function initExpOptions() {
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const opt = document.createElement("option");
        opt.value = mm;
        opt.textContent = mm;
        expMonth.appendChild(opt);
    }
    const year = new Date().getFullYear();
    for (let y = 0; y < 12; y++) {
        const yy = String((year + y) % 100).padStart(2, "0");
        const opt = document.createElement("option");
        opt.value = yy;
        opt.textContent = `${year + y} (${yy})`;
        expYear.appendChild(opt);
    }
})();

function formatCardNumber(raw) {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

cardNumber.addEventListener("input", () => {
    cardNumber.value = formatCardNumber(cardNumber.value);
    pvNumber.textContent = cardNumber.value || "1234 1234 1234 1234";
});

billName.addEventListener("input", () => {
    pvHolder.textContent = (billName.value || "IMANE").toUpperCase();
});

function updateExpPreview() {
    const m = expMonth.value || "MM";
    const y = expYear.value || "YY";
    pvExp.textContent = `${m}/${y}`;
}
expMonth.addEventListener("change", updateExpPreview);
expYear.addEventListener("change", updateExpPreview);

/* =========================
   TICKET + PDF
   ========================= */
const ticketCaptureArea = $("#ticketCaptureArea");

function randomDigits(len) {
    let s = "";
    for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
    return s;
}
function makeTicketNumber() {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return `V-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${randomDigits(4)}`;
}

function buildTicketHTML(order) {
    const lineDash = `<div class="dash"></div>`;
    const itemsRows = order.items.map(it => {
        return `
      <tr>
        <td>${it.qty}</td>
        <td>${sanitizeText(it.name).slice(0, 18)}</td>
        <td class="r">${money(it.price)}</td>
        <td class="r">${money(it.qty * it.price)}</td>
      </tr>
    `;
    }).join("");

    const tvaRate = order.tvaRate ?? 0.20;
    const mtTTC = order.subtotal;
    const mtHT = mtTTC / (1 + tvaRate);
    const mtTVA = mtTTC - mtHT;

    return `
    <div class="ticket-paper" id="ticketPaper">
      <div class="ticket-center">
        <div class="ticket-title">MA CARTE DE FIDELITE</div>
        <div class="ticket-small">CONTRE LA VIE CHERE</div>
        <div class="ticket-small">CASABLANCA - MAROC</div>
        <div class="ticket-small">TEL: 06 00 00 00 00</div>
      </div>

      ${lineDash}
      <div class="ticket-line"><span><b>TICKET:</b> ${order.ticketNo}</span><span></span></div>
      <div class="ticket-line"><span><b>DATE:</b> ${order.dt.date} ${order.dt.time}</span><span></span></div>
      <div class="ticket-line"><span><b>CLIENT:</b> ${sanitizeText(order.customer)}</span><span></span></div>
      <div class="ticket-line"><span><b>PAIEMENT:</b> ${sanitizeText(order.payment)}</span><span></span></div>

      ${lineDash}

      <table class="ticket-table">
        <thead>
          <tr>
            <th>QTE</th><th>ARTICLE</th><th class="r">PRIX</th><th class="r">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      ${lineDash}

      <div class="ticket-line"><span>SOUS-TOTAL:</span><span>${money(order.subtotal)} MAD</span></div>
      <div class="ticket-line"><span>REMISE:</span><span>0.00 MAD</span></div>
      <div class="ticket-line"><span><b>TOTAL:</b></span><span><b>${money(order.subtotal)} MAD</b></span></div>
      <div class="ticket-line"><span>RECU:</span><span>${money(order.subtotal)} MAD</span></div>
      <div class="ticket-line"><span>RENDU:</span><span>0.00 MAD</span></div>

      ${lineDash}

      <div class="ticket-center ticket-title" style="font-size:12px;">RECAPITULATIF TVA</div>
      <div class="ticket-small">
        CODE TVA &nbsp;&nbsp; TAUX &nbsp;&nbsp; MT.HT &nbsp;&nbsp; MT.TVA &nbsp;&nbsp; MT.TTC
      </div>
      <div class="ticket-small">
        B &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${(tvaRate * 100).toFixed(2)}% &nbsp;&nbsp; ${money(mtHT)} &nbsp;&nbsp; ${money(mtTVA)} &nbsp;&nbsp; ${money(mtTTC)}
      </div>

      ${lineDash}

      <div class="ticket-line"><span><b>CARTE DE FIDELITE</b></span><span>${order.cardNo}</span></div>
      <div class="ticket-line"><span>ANCIEN SOLDE</span><span>${money(order.oldBalance)}</span></div>
      <div class="ticket-line"><span>NOUVEAU SOLDE</span><span>${money(order.newBalance)}</span></div>

      <div class="ticket-center ticket-small" style="margin-top:8px;">
        Ce ticket vaut bon de garantie.
      </div>
      <div class="ticket-center ticket-small" style="margin-top:6px;">
        <b>MERCI DE VOTRE FIDELITE. A BIENTOT</b>
      </div>

      <div class="barcode"></div>
      <div class="ticket-id">${order.barcode}</div>
    </div>
  `;
}

async function downloadOrderPDF(order) {
    const itemsHtml = order.items.map(it => {
        return `
      <div class="pdf-item">
        <img src="${it.img}" alt="">
        <div>
          <h4>${sanitizeText(it.name)}</h4>
          <div class="meta">CatÃ©gorie: ${sanitizeText(it.category)} â€¢ Prix: ${money(it.price)} DH â€¢ QtÃ©: ${it.qty}</div>
          <p>${sanitizeText(it.desc || "")}</p>
        </div>
      </div>
    `;
    }).join("");

    ticketCaptureArea.innerHTML = `
    <div style="display:flex; gap:20px; align-items:flex-start;">
      ${buildTicketHTML(order)}
      <div style="flex:1;">
        <h2 style="margin:0 0 8px;">Commande / Produits</h2>
        <div style="color:#444; font-size:13px;">
          Client: <b>${sanitizeText(order.customer)}</b> â€” Date: ${order.dt.date} ${order.dt.time}
        </div>
        <div class="pdf-products">
          <h3>Produits achetÃ©s</h3>
          ${itemsHtml}
          <div style="margin-top:14px; border-top:1px solid #ddd; padding-top:10px; font-size:14px;">
            <b>Total:</b> ${money(order.subtotal)} MAD
          </div>
        </div>
      </div>
    </div>
  `;

    ticketCaptureArea.classList.remove("hidden");

    const canvas = await html2canvas(ticketCaptureArea, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let remaining = imgH;
    let position = 0;

    while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        remaining -= pageH;
        position -= pageH;
        if (remaining > 0) pdf.addPage();
    }

    const fileName = `ticket_${order.ticketNo.replace(/[^a-z0-9-_]/gi, "_")}.pdf`;
    pdf.save(fileName);

    ticketCaptureArea.classList.add("hidden");
}

btnPayNow.addEventListener("click", async () => {
    const cn = formatCardNumber(cardNumber.value || "");
    const mm = expMonth.value;
    const yy = expYear.value;
    const cvv = (cardCvv.value || "").replace(/\D/g, "");
    const name = sanitizeText(billName.value).trim() || (state.session?.user || "CLIENT");

    if (cn.replace(/\s/g, "").length !== 16) {
        alert("NumÃ©ro de carte invalide (16 chiffres).");
        return;
    }
    if (!mm || !yy) {
        alert("Choisis la date d'expiration.");
        return;
    }
    if (cvv.length < 3) {
        alert("CVV invalide.");
        return;
    }
    if (!billCity.value.trim() || !billAddr.value.trim()) {
        alert("Remplis l'adresse (Ville + Adresse).");
        return;
    }

    const items = cartItemsDetailed();
    if (!items.length) {
        alert("Panier vide.");
        return;
    }

    // check stock
    for (const it of items) {
        const p = state.products.find(x => x.id === it.product.id);
        if (!p) continue;
        if (it.qty > p.stock) { alert(`Stock insuffisant pour: ${p.name}`); return; }
    }

    const dt = nowDateTime();
    const subtotal = cartSubtotalValue();
    const ticketNo = makeTicketNumber();
    const barcode = `${dt.iso.slice(0, 10).replace(/-/g, '')}${randomDigits(16)}`;
    const orderItems = items.map(it => ({
        id: it.product.id,
        name: it.product.name,
        category: normalizeCategory(it.product.category),
        price: Number(it.product.price),
        qty: Number(it.qty),
        desc: it.product.desc || '',
        img: it.product.img
    }));
    const billing = { fullName: name, country: billCountry.value, city: billCity.value, address: billAddr.value };

    // Save order to DB (also deducts stock server-side)
    const orderRes = await apiFetch('api/orders.php?action=add', {
        ticketNo, customer: name.toUpperCase(), subtotal, tvaRate: 0.20,
        payment: 'Card', billing, items: orderItems, barcode
    });
    if (!orderRes.success) { alert(orderRes.msg || 'Erreur sauvegarde commande.'); return; }

    // Deduct stock locally
    for (const it of items) {
        const p = state.products.find(x => x.id === it.product.id);
        if (p) p.stock = Math.max(0, p.stock - it.qty);
    }

    const order = {
        id: uid(), ticketNo, dt,
        customer: name.toUpperCase(), payment: 'Card',
        cardNo: randomDigits(16), oldBalance: 28.13, newBalance: 28.13,
        barcode, tvaRate: 0.20, subtotal, items: orderItems, billing
    };
    state.orders.unshift(order);
    state.cart = [];
    save('gs_cart', []);

    closePayModal();

    lastTicketWrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; align-items:flex-start;">
      ${buildTicketHTML(order)}
      <button class="btn-primary" id="btnDownloadPdf" type="button">
        <i class="fa-solid fa-file-pdf"></i> TÃ©lÃ©charger PDF
      </button>
    </div>
  `;

    $("#btnDownloadPdf").addEventListener("click", () => downloadOrderPDF(order));

    setActiveNav("cashier");
    renderCart();
    renderDashboard();
});

/* =========================
   DASHBOARD + CATEGORIES
   ========================= */
function renderDashboard() {
    $("#statProducts").textContent = String(state.products.length);
    $("#statOrders").textContent = String(state.orders.length);
    $("#statStock").textContent = String(state.products.reduce((s, p) => s + Number(p.stock || 0), 0));
    $("#statOut").textContent = String(state.products.filter(p => Number(p.stock || 0) <= 0).length);

    // Add client/supplier count if you want to show it on dashboard, 
    // but the HTML doesn't have slots for them yet. 
    // We will just leave it as is or maybe add console log.
}

function renderClients() {
    const tbody = $("#clientsTableBody");
    const badge = $("#totalClientsBadge");
    if (!tbody) return;

    const list = state.clients || [];
    badge.textContent = `${list.length} client${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted center">Aucun client.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr>
            <td>
                <div style="font-weight:500;">${sanitizeText(c.name)}</div>
                <div class="muted small">${sanitizeText(c.email)}</div>
            </td>
            <td>${sanitizeText(c.phone)}</td>
            <td>${sanitizeText(c.city)}</td>
            <td><span class="badge ${c.status === 'Actif' ? 'success' : 'warning'}">${c.status}</span></td>
            <td class="r" style="display:flex;gap:6px;justify-content:flex-end;">
                <button class="icon-btn" data-edit-client="${c.id}" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" data-del-client="${c.id}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join("");

    $$("[data-edit-client]").forEach(btn => {
        btn.addEventListener("click", () => openClientModal(btn.dataset.editClient));
    });
    $$("[data-del-client]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.delClient;
            const c = (state.clients || []).find(x => x.id === id);
            if (c && confirm(`Supprimer le client "${c.name}" ?`)) {
                const res = await apiFetch('api/clients.php?action=delete', { id: Number(id) || id });
                if (res.success) {
                    state.clients = state.clients.filter(x => x.id !== id);
                    renderClients(); renderDiagramme();
                } else { alert(res.msg || 'Erreur.'); }
            }
        });
    });
}

function renderSuppliers() {
    const tbody = $("#suppliersTableBody");
    const badge = $("#totalSuppliersBadge");
    if (!tbody) return;

    const list = state.suppliers || [];
    badge.textContent = `${list.length} fournisseur${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted center">Aucun fournisseur.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td style="font-weight:500;">${sanitizeText(s.name)}</td>
            <td><span class="chip">${sanitizeText(s.category)}</span></td>
            <td>${sanitizeText(s.contact)}</td>
            <td>${sanitizeText(s.phone)}</td>
            <td class="r" style="display:flex;gap:6px;justify-content:flex-end;">
                <button class="icon-btn" data-edit-sup="${s.id}" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" data-del-sup="${s.id}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join("");

    $$("[data-edit-sup]").forEach(btn => {
        btn.addEventListener("click", () => openSupplierModal(btn.dataset.editSup));
    });
    $$("[data-del-sup]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.delSup;
            const s = (state.suppliers || []).find(x => x.id === id);
            if (s && confirm(`Supprimer le fournisseur "${s.name}" ?`)) {
                const res = await apiFetch('api/suppliers.php?action=delete', { id: Number(id) || id });
                if (res.success) {
                    state.suppliers = state.suppliers.filter(x => x.id !== id);
                    renderSuppliers(); renderDiagramme();
                } else { alert(res.msg || 'Erreur.'); }
            }
        });
    });
}

function renderCategories() {
    const cats = getCategories();
    const container = $("#catList");
    if (!container) return;
    container.innerHTML = cats.map(c => `
        <div class="cat-chip-edit">
            <span class="chip-pill">${c}</span>
            <button class="icon-btn small" data-edit-cat="${c}" title="Renommer"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn small danger" data-del-cat="${c}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("") || `<span class="muted">Aucune cat\u00e9gorie.</span>`;

    $$("[data-edit-cat]").forEach(btn => {
        btn.addEventListener("click", () => openCategoryModal(btn.dataset.editCat));
    });
    $$("[data-del-cat]").forEach(btn => {
        btn.addEventListener("click", () => {
            const cat = btn.dataset.delCat;
            const count = (state.products || []).filter(p => normalizeCategory(p.category) === cat).length;
            const msg = count > 0
                ? `Supprimer la cat\u00e9gorie "${cat}" ? (${count} produit(s) seront mis en cat\u00e9gorie AUTRE)`
                : `Supprimer la cat\u00e9gorie "${cat}" ?`;
            if (confirm(msg)) {
                if (count > 0) {
                    state.products = state.products.map(p =>
                        normalizeCategory(p.category) === cat ? { ...p, category: 'AUTRE' } : p
                    );
                    save(LS_KEYS.products, state.products);
                }
                renderCategories();
                renderProducts();
                renderDiagramme();
            }
        });
    });
}

/* =========================
   EDIT PRODUCT MODAL
   ========================= */
const modalEditProduct = $("#modalEditProduct");

function openEditProductModal(id) {
    const p = (state.products || []).find(x => x.id === id);
    if (!p) return;
    $("#epId").value = p.id;
    $("#epName").value = p.name;
    $("#epCat").value = p.category;
    $("#epPrice").value = p.price;
    $("#epStock").value = p.stock;
    $("#epDesc").value = p.desc || "";
    $("#epImgUrl").value = p.img || "";
    $("#epPreview").src = p.img || "";
    modalEditProduct.classList.remove("hidden");
}
function closeEditProductModal() { modalEditProduct.classList.add("hidden"); }

$("#btnCloseEditProduct").addEventListener("click", closeEditProductModal);
$("#btnCancelEditProduct").addEventListener("click", closeEditProductModal);
$("#epImgUrl").addEventListener("input", () => { $("#epPreview").src = $("#epImgUrl").value.trim(); });

$("#btnSaveEditProduct").addEventListener("click", async () => {
    const id = $("#epId").value;
    const idx = (state.products || []).findIndex(x => x.id === id);
    if (idx === -1) return;
    const name = sanitizeText($("#epName").value).trim();
    const cat = normalizeCategory($("#epCat").value);
    const price = Number($("#epPrice").value);
    const stock = Number($("#epStock").value);
    const desc = sanitizeText($("#epDesc").value).trim();
    const img = $("#epImgUrl").value.trim() || state.products[idx].img;

    if (!name || !cat || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
        alert("Remplis: Nom, Catégorie, Prix, Stock (valeurs valides)."); return;
    }
    const res = await apiFetch('api/products.php?action=edit', {
        id: Number(id) || id, name, category: cat, price, stock,
        description: desc, img_url: img, popular: state.products[idx].popular ? 1 : 0
    });
    if (res.success) {
        state.products[idx] = { ...state.products[idx], name, category: cat, price, stock, desc, img };
        closeEditProductModal();
        refreshAll();
    } else { alert(res.msg || 'Erreur modification.'); }
});

/* =========================
   CLIENT MODAL CRUD
   ========================= */
const modalClient = $("#modalClient");

function openClientModal(id) {
    const isEdit = !!id;
    $("#clientModalTitle").textContent = isEdit ? "Modifier le client" : "Ajouter un client";
    const c = isEdit ? (state.clients || []).find(x => x.id === id) : null;
    $("#cId").value = c ? c.id : "";
    $("#cName").value = c ? c.name : "";
    $("#cEmail").value = c ? c.email : "";
    $("#cPhone").value = c ? c.phone : "";
    $("#cCity").value = c ? c.city : "";
    $("#cStatus").value = c ? c.status : "Actif";
    modalClient.classList.remove("hidden");
}
function closeClientModal() { modalClient.classList.add("hidden"); }

$("#btnAddClient").addEventListener("click", () => openClientModal(null));
$("#btnCloseClient").addEventListener("click", closeClientModal);
$("#btnCancelClient").addEventListener("click", closeClientModal);

$("#btnSaveClient").addEventListener("click", async () => {
    const id = $("#cId").value;
    const name = sanitizeText($("#cName").value).trim();
    const email = sanitizeText($("#cEmail").value).trim();
    const phone = sanitizeText($("#cPhone").value).trim();
    const city = sanitizeText($("#cCity").value).trim();
    const status = $("#cStatus").value;
    if (!name) { alert("Le nom est requis."); return; }

    const action = id ? 'edit' : 'add';
    const body = id ? { id: Number(id) || id, name, email, phone, city, status }
        : { name, email, phone, city, status };
    const res = await apiFetch(`api/clients.php?action=${action}`, body);
    if (res.success) {
        if (id) {
            const idx = (state.clients || []).findIndex(x => x.id === id);
            if (idx !== -1) state.clients[idx] = { ...state.clients[idx], name, email, phone, city, status };
        } else {
            state.clients.unshift(normalizeClient({ ...res.data }));
        }
        closeClientModal();
        renderClients();
        renderDiagramme();
    } else { alert(res.msg || 'Erreur.'); }
});

/* =========================
   SUPPLIER MODAL CRUD
   ========================= */
const modalSupplier = $("#modalSupplier");

function openSupplierModal(id) {
    const isEdit = !!id;
    $("#supplierModalTitle").textContent = isEdit ? "Modifier le fournisseur" : "Ajouter un fournisseur";
    const s = isEdit ? (state.suppliers || []).find(x => x.id === id) : null;
    $("#sId").value = s ? s.id : "";
    $("#sName").value = s ? s.name : "";
    $("#sCat").value = s ? s.category : "";
    $("#sContact").value = s ? s.contact : "";
    $("#sPhone").value = s ? s.phone : "";
    modalSupplier.classList.remove("hidden");
}
function closeSupplierModal() { modalSupplier.classList.add("hidden"); }

$("#btnAddSupplier").addEventListener("click", () => openSupplierModal(null));
$("#btnCloseSupplier").addEventListener("click", closeSupplierModal);
$("#btnCancelSupplier").addEventListener("click", closeSupplierModal);

$("#btnSaveSupplier").addEventListener("click", async () => {
    const id = $("#sId").value;
    const name = sanitizeText($("#sName").value).trim();
    const category = normalizeCategory($("#sCat").value);
    const contact = sanitizeText($("#sContact").value).trim();
    const phone = sanitizeText($("#sPhone").value).trim();
    if (!name) { alert("Le nom de la société est requis."); return; }

    const action = id ? 'edit' : 'add';
    const body = id ? { id: Number(id) || id, name, category, contact, phone }
        : { name, category, contact, phone };
    const res = await apiFetch(`api/suppliers.php?action=${action}`, body);
    if (res.success) {
        if (id) {
            const idx = (state.suppliers || []).findIndex(x => x.id === id);
            if (idx !== -1) state.suppliers[idx] = { ...state.suppliers[idx], name, category, contact, phone };
        } else {
            state.suppliers.unshift(normalizeSupplier({ ...res.data }));
        }
        closeSupplierModal();
        renderSuppliers(); renderDiagramme();
    } else { alert(res.msg || 'Erreur.'); }
});

/* =========================
   CATEGORY MODAL CRUD
   ========================= */
const modalCategory = $("#modalCategory");

function openCategoryModal(oldName) {
    const isEdit = !!oldName;
    $("#categoryModalTitle").textContent = isEdit ? "Renommer la cat\u00e9gorie" : "Ajouter une cat\u00e9gorie";
    $("#catOldName").value = oldName || "";
    $("#catNewName").value = oldName || "";
    modalCategory.classList.remove("hidden");
}
function closeCategoryModal() { modalCategory.classList.add("hidden"); }

$("#btnAddCategory").addEventListener("click", () => openCategoryModal(null));
$("#btnCloseCategory").addEventListener("click", closeCategoryModal);
$("#btnCancelCategory").addEventListener("click", closeCategoryModal);

$("#btnSaveCategory").addEventListener("click", async () => {
    const oldName = $("#catOldName").value.trim();
    const newName = normalizeCategory($("#catNewName").value);
    if (!newName) { alert("Le nom de la catégorie est requis."); return; }

    if (oldName) {
        // Rename category for all matching products via API
        const toRename = (state.products || []).filter(p => normalizeCategory(p.category) === oldName);
        await Promise.all(toRename.map(p =>
            apiFetch('api/products.php?action=edit', {
                id: Number(p.id) || p.id, name: p.name, category: newName,
                price: p.price, stock: p.stock, description: p.desc, img_url: p.img, popular: p.popular ? 1 : 0
            })
        ));
        state.products = (state.products || []).map(p =>
            normalizeCategory(p.category) === oldName ? { ...p, category: newName } : p
        );
    } else {
        alert(`Catégorie "${newName}" sera disponible lorsque vous ajouterez un produit avec cette catégorie.`);
        closeCategoryModal(); return;
    }
    closeCategoryModal();
    refreshAll();
});

/* =========================
   DIAGRAMME (Chart.js - Professional)
   ========================= */

// Track Chart.js instances to destroy on re-render
const _charts = {};

function destroyChart(id) {
    if (_charts[id]) {
        _charts[id].destroy();
        delete _charts[id];
    }
}

// Shared dark theme defaults
const CHART_DEFAULTS = {
    color: "#94a3b8",
    borderColor: "rgba(255,255,255,0.06)",
};

const ACCENT = {
    violet: "#7c3aed",
    indigo: "#6366f1",
    cyan: "#06b6d4",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    pink: "#ec4899",
    blue: "#3b82f6",
};

const PALETTE = [
    ACCENT.indigo, ACCENT.emerald, ACCENT.amber,
    ACCENT.rose, ACCENT.blue, ACCENT.violet, ACCENT.pink
];

function renderDiagramme() {
    // --- Stat cards (new dashboard style) ---
    const statsEl = $("#diagramStats");
    if (statsEl) {
        const totalStock = (state.products || []).reduce((s, p) => s + (Number(p.stock) || 0), 0);
        const statsData = [
            {
                label: "Clients",
                value: (state.clients || []).length,
                icon: "fa-users",
                cardClass: "diag-card-clients"
            },
            {
                label: "Fournisseurs",
                value: (state.suppliers || []).length,
                icon: "fa-truck",
                cardClass: "diag-card-suppliers"
            },
            {
                label: "Produits",
                value: (state.products || []).length,
                icon: "fa-box",
                cardClass: "diag-card-products"
            },
            {
                label: "Stock Total",
                value: totalStock,
                icon: "fa-cubes",
                cardClass: "diag-card-stock"
            }
        ];
        statsEl.innerHTML = statsData.map(s => `
            <div class="diag-stat-card ${s.cardClass}">
                <div class="diag-stat-icon-big"><i class="fa-solid ${s.icon}"></i></div>
                <div class="diag-stat-value">${s.value}</div>
                <div class="diag-stat-name">${s.label}</div>
            </div>
        `).join("");
    }

    // Dark purple shared theme
    const PURPLE_SCALES = {
        x: {
            grid: { color: "rgba(167,139,250,0.07)", drawBorder: false },
            ticks: { color: "#7c6fa0", font: { family: "'Poppins', sans-serif", size: 10 } },
            border: { display: false }
        },
        y: {
            grid: { color: "rgba(167,139,250,0.07)", drawBorder: false },
            ticks: { color: "#7c6fa0", font: { family: "'Poppins', sans-serif", size: 10 } },
            border: { display: false }
        }
    };
    const PURPLE_TOOLTIP = {
        backgroundColor: "rgba(20,10,50,0.95)",
        titleColor: "#e2e8f0", bodyColor: "#a78bfa",
        borderColor: "rgba(139,92,246,0.5)", borderWidth: 1,
        padding: 12, cornerRadius: 10,
        titleFont: { family: "'Poppins', sans-serif", weight: "600" },
        bodyFont: { family: "'Poppins', sans-serif" }
    };
    const PURPLE_LEGEND = {
        labels: {
            color: "#c4b5fd",
            font: { family: "'Poppins', sans-serif", size: 11 },
            usePointStyle: true, pointStyle: "circle", padding: 16
        }
    };

    setTimeout(() => {
        // ─── 1. Area chart: orders trend ──────────────────────────────────────
        const ordersEl = document.getElementById("chartOrders");
        destroyChart("chartOrders");
        if (ordersEl) {
            const ordersMap = {};
            (state.orders || []).forEach(o => {
                const day = (o.dt && o.dt.date) ? o.dt.date : "?";
                ordersMap[day] = (ordersMap[day] || 0) + 1;
            });
            let orderDays = Object.keys(ordersMap).slice(-7);
            let orderCounts = orderDays.map(d => ordersMap[d]);
            if (!orderDays.length) {
                orderDays = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
                orderCounts = [0, 0, 0, 0, 0];
            }
            const ctx = ordersEl.getContext("2d");
            const amberGrad = ctx.createLinearGradient(0, 0, 0, 200);
            amberGrad.addColorStop(0, "#f59e0b66"); amberGrad.addColorStop(1, "#f59e0b00");
            _charts["chartOrders"] = new Chart(ctx, {
                type: "line",
                data: {
                    labels: orderDays,
                    datasets: [{
                        label: "Commandes", data: orderCounts,
                        borderColor: "#f59e0b", backgroundColor: amberGrad, fill: true,
                        tension: 0.4, pointRadius: 5, pointBackgroundColor: "#f59e0b",
                        pointBorderColor: "#1a1040", pointBorderWidth: 2, pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 800, easing: "easeOutQuart" },
                    plugins: { legend: { display: false }, tooltip: PURPLE_TOOLTIP },
                    scales: PURPLE_SCALES
                }
            });
        }

        // ─── 2. Vertical bar: products per supplier category ─────────────────
        const suppEl = document.getElementById("chartSupplierProd");
        destroyChart("chartSupplierProd");
        if (suppEl) {
            const suppCats = [...new Set((state.suppliers || []).map(s => s.category || "Autre"))];
            const suppCounts = suppCats.map(cat =>
                (state.products || []).filter(p => normalizeCategory(p.category) === cat).length
            );
            const ctx = suppEl.getContext("2d");
            const orangeColors = [
                "#f59e0b", "#fb923c", "#f87171", "#fbbf24", "#fca5a5", "#fde68a", "#fed7aa"
            ];
            _charts["chartSupplierProd"] = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: suppCats,
                    datasets: [{
                        label: "Produits",
                        data: suppCounts,
                        backgroundColor: suppCats.map((_, i) => orangeColors[i % orangeColors.length] + "cc"),
                        borderColor: suppCats.map((_, i) => orangeColors[i % orangeColors.length]),
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 800, easing: "easeOutQuart" },
                    plugins: { legend: { display: false }, tooltip: PURPLE_TOOLTIP },
                    scales: PURPLE_SCALES
                }
            });
        }

        // ─── 3. Horizontal bar: top products by stock (like resource TOP10) ──
        const catEl = document.getElementById("chartCat");
        destroyChart("chartCat");
        if (catEl) {
            const sorted = [...(state.products || [])]
                .sort((a, b) => (b.stock || 0) - (a.stock || 0))
                .slice(0, 8);
            const names = sorted.map(p => p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name);
            const stocks = sorted.map(p => p.stock || 0);
            const ctx = catEl.getContext("2d");
            const barColors = [
                "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#38bdf8", "#818cf8", "#e879f9"
            ];
            _charts["chartCat"] = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: names,
                    datasets: [{
                        label: "Stock",
                        data: stocks,
                        backgroundColor: stocks.map((_, i) => barColors[i % barColors.length] + "99"),
                        borderColor: stocks.map((_, i) => barColors[i % barColors.length]),
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: "y",
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 800, easing: "easeOutQuart" },
                    plugins: { legend: { display: false }, tooltip: PURPLE_TOOLTIP },
                    scales: {
                        x: { ...PURPLE_SCALES.x, ticks: { ...PURPLE_SCALES.x.ticks, font: { size: 9 } } },
                        y: { ...PURPLE_SCALES.y, ticks: { ...PURPLE_SCALES.y.ticks, font: { size: 9 } } }
                    }
                }
            });
        }

        // ─── 4. Doughnut: in-stock vs out-of-stock ───────────────────────────
        const clientEl = document.getElementById("chartClients");
        destroyChart("chartClients");
        if (clientEl) {
            const inStock = (state.products || []).filter(p => (p.stock || 0) > 5).length;
            const lowStock = (state.products || []).filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length;
            const outStock = (state.products || []).filter(p => (p.stock || 0) === 0).length;
            const totalP = (state.products || []).length || 1;
            const ctx = clientEl.getContext("2d");

            // Update custom legend
            const legendEl = document.getElementById("donutLegend");
            if (legendEl) {
                const legendData = [
                    { label: "En stock", value: inStock, color: "#f59e0b" },
                    { label: "Stock bas", value: lowStock, color: "#e879f9" },
                    { label: "Rupture", value: outStock, color: "#f43f5e" }
                ];
                legendEl.innerHTML = legendData.map(l => `
                    <div class="diag-donut-legend-item">
                        <div class="diag-donut-legend-left">
                            <div class="diag-donut-legend-dot" style="background:${l.color}"></div>
                            <span>${l.label}</span>
                        </div>
                        <span class="diag-donut-legend-val">${l.value}</span>
                    </div>
                `).join("");
            }

            _charts["chartClients"] = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: ["En stock", "Stock bas", "Rupture"],
                    datasets: [{
                        data: [inStock, lowStock, outStock],
                        backgroundColor: ["#f59e0bcc", "#e879f9cc", "#f43f5ecc"],
                        borderColor: ["#f59e0b", "#e879f9", "#f43f5e"],
                        borderWidth: 2, hoverOffset: 12
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: "65%",
                    animation: { animateRotate: true, duration: 1000 },
                    plugins: { legend: { display: false }, tooltip: PURPLE_TOOLTIP },
                    layout: { padding: 4 }
                },
                plugins: [{
                    id: "centerText",
                    afterDraw(chart) {
                        const { ctx: c, chartArea: { width, height, left, top } } = chart;
                        c.save();
                        c.font = `bold 22px 'Poppins',sans-serif`;
                        c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
                        c.fillText(totalP, left + width / 2, top + height / 2 - 8);
                        c.font = `10px 'Poppins',sans-serif`;
                        c.fillStyle = "#a78bfa";
                        c.fillText("produits", left + width / 2, top + height / 2 + 12);
                        c.restore();
                    }
                }]
            });
        }

        // ─── 5. Horizontal bar: stock per category ────────────────────────────
        const revEl = document.getElementById("chartRevenue");
        destroyChart("chartRevenue");
        if (revEl) {
            const cats3 = getCategories();
            const stockPerCat = cats3.map(cat =>
                (state.products || [])
                    .filter(p => normalizeCategory(p.category) === cat)
                    .reduce((s, p) => s + (Number(p.stock) || 0), 0)
            );
            const ctx = revEl.getContext("2d");
            const blueColors = ["#60a5fa", "#818cf8", "#a78bfa", "#c084fc", "#e879f9", "#f472b6", "#fb7185"];
            _charts["chartRevenue"] = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: cats3,
                    datasets: [{
                        label: "Stock",
                        data: stockPerCat,
                        backgroundColor: cats3.map((_, i) => blueColors[i % blueColors.length] + "99"),
                        borderColor: cats3.map((_, i) => blueColors[i % blueColors.length]),
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: "y",
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 800, easing: "easeOutQuart" },
                    plugins: { legend: { display: false }, tooltip: PURPLE_TOOLTIP },
                    scales: {
                        x: { ...PURPLE_SCALES.x, ticks: { ...PURPLE_SCALES.x.ticks, font: { size: 9 } } },
                        y: { ...PURPLE_SCALES.y, ticks: { ...PURPLE_SCALES.y.ticks, font: { size: 9 } } }
                    }
                }
            });
        }
    }, 60);
}

/* =========================
   REFRESH
   ========================= */
function refreshAll() {
    refreshCategoryFilter();
    renderProducts();
    renderCart();
    renderDashboard();
    renderCategories();
    renderClients();
    renderSuppliers();
    // Only re-render diagramme if it's visible
    if ($("#page-diagramme") && !$("#page-diagramme").classList.contains("hidden")) {
        renderDiagramme();
    }
}

/* =========================
   INIT — check PHP session on page load
   ========================= */
(async () => {
    const res = await apiFetch('api/auth.php?action=check');
    if (res.success && res.data) {
        state.session = res.data;
        await showApp();
    } else {
        showLogin();
    }
    setActiveNav('dashboard');
    renderDashboard();
})();
