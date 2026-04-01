/* =============================================
   StockBot AI — Assistant Intelligent
   Chatbot local, propulsé par des règles IA
   contextuelle + données de l'app
   ============================================= */

(function () {
    'use strict';

    /* ── DOM References ── */
    const fab         = document.getElementById('chatbotFab');
    const chatWindow  = document.getElementById('chatbotWindow');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput   = document.getElementById('chatInput');
    const chatSendBtn  = document.getElementById('chatSendBtn');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatMinBtn   = document.getElementById('chatMinBtn');
    const chatClearBtn = document.getElementById('chatClearBtn');
    const chatBadge    = document.getElementById('chatBadge');
    const suggestions  = document.getElementById('chatSuggestions');

    /* ── State ── */
    let isOpen      = false;
    let isMinimized = false;
    let hasUnread   = true;
    let conversationHistory = [];

    /* ── Utility ── */
    function getTime() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ── Badge logic ── */
    function showBadge()  { chatBadge.classList.remove('hidden-badge'); }
    function hideBadge()  { chatBadge.classList.add('hidden-badge'); }

    /* ── Toggle Open/Close ── */
    fab.addEventListener('click', () => {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    });

    chatCloseBtn.addEventListener('click', closeChat);

    chatMinBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        chatWindow.classList.toggle('minimized', isMinimized);
        chatMinBtn.querySelector('i').className = isMinimized
            ? 'fa-solid fa-expand'
            : 'fa-solid fa-minus';
    });

    chatClearBtn.addEventListener('click', () => {
        conversationHistory = [];
        chatMessages.innerHTML = '';
        appendBotMessage('Conversation effacée. Comment puis-je vous aider ?');
    });

    function openChat() {
        isOpen = true;
        chatWindow.classList.remove('hidden');
        hideBadge();
        hasUnread = false;
        // Show welcome if first time
        if (chatMessages.children.length === 0) {
            appendWelcome();
        }
        chatInput.focus();
    }

    function closeChat() {
        isOpen = false;
        chatWindow.classList.add('hidden');
    }

    /* ── Message rendering ── */
    function appendWelcome() {
        appendTimeStamp('Maintenant');
        const user = (typeof state !== 'undefined' && state.session)
            ? (state.session.username || state.session.user || '').toUpperCase()
            : '';
        const greeting = user ? `Bonjour **${user}** 👋` : 'Bonjour 👋';
        appendBotMessage(
            `${greeting}, je suis **StockBot AI**, votre assistant de gestion de stock.\n\nJe peux vous aider à :\n• 📦 Consulter votre stock\n• 👥 Gérer vos clients\n• 🚚 Voir vos fournisseurs\n• 📊 Analyser vos données\n\nQue souhaitez-vous savoir ?`
        );
    }

    function appendTimeStamp(label) {
        const div = document.createElement('div');
        div.className = 'chat-time';
        div.textContent = label;
        chatMessages.appendChild(div);
    }

    function formatMarkdown(text) {
        // Bold **text**
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Line breaks
        text = text.replace(/\n/g, '<br>');
        // Bullet points with •
        text = text.replace(/• /g, '• ');
        return text;
    }

    function appendBotMessage(text) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg bot';
        wrap.innerHTML = `
            <div class="chat-msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble">${formatMarkdown(escapeHtml(text).replace(/&lt;strong&gt;/g,'<strong>').replace(/&lt;\/strong&gt;/g,'</strong>').replace(/&lt;br&gt;/g,'<br>'))}</div>
        `;
        chatMessages.appendChild(wrap);
        scrollToBottom();
        conversationHistory.push({ role: 'bot', text });
    }

    function appendUserMessage(text) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg user';
        wrap.innerHTML = `
            <div class="chat-msg-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="chat-bubble">${escapeHtml(text)}</div>
        `;
        chatMessages.appendChild(wrap);
        scrollToBottom();
        conversationHistory.push({ role: 'user', text });
    }

    function showTyping() {
        const wrap = document.createElement('div');
        wrap.className = 'chat-typing';
        wrap.id = 'chatTyping';
        wrap.innerHTML = `
            <div class="chat-msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-typing-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        chatMessages.appendChild(wrap);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById('chatTyping');
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /* ── Suggestion chips ── */
    suggestions.querySelectorAll('.chat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const msg = chip.dataset.msg;
            if (msg) handleUserInput(msg);
        });
    });

    /* ── Send message ── */
    chatSendBtn.addEventListener('click', () => {
        const val = chatInput.value.trim();
        if (val) {
            chatInput.value = '';
            handleUserInput(val);
        }
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const val = chatInput.value.trim();
            if (val) {
                chatInput.value = '';
                handleUserInput(val);
            }
        }
    });

    /* ── AI Core ── */
    async function handleUserInput(text) {
        appendUserMessage(text);
        suggestions.style.display = 'none'; // hide after first use

        showTyping();
        // Simulate thinking time (600–1400ms)
        const delay = 600 + Math.random() * 800;
        await new Promise(r => setTimeout(r, delay));
        hideTyping();

        const response = generateResponse(text.toLowerCase());
        appendBotMessage(response);
    }

    /* ── Context helpers ── */
    function getState() {
        return (typeof state !== 'undefined') ? state : null;
    }

    function getProducts() {
        const s = getState();
        return s ? (s.products || []) : [];
    }

    function getClients() {
        const s = getState();
        return s ? (s.clients || []) : [];
    }

    function getSuppliers() {
        const s = getState();
        return s ? (s.suppliers || []) : [];
    }

    function getOrders() {
        const s = getState();
        return s ? (s.orders || []) : [];
    }

    function getCart() {
        const s = getState();
        return s ? (s.cart || []) : [];
    }

    /* ── Response Engine ── */
    function generateResponse(q) {
        const products  = getProducts();
        const clients   = getClients();
        const suppliers = getSuppliers();
        const orders    = getOrders();
        const cart      = getCart();

        /* ─ Greetings ─ */
        if (/^(bonjour|salut|hello|hey|hi|bonsoir|coucou|salam|مرحبا)/.test(q)) {
            const greets = [
                'Bonjour ! 😊 Comment puis-je vous aider aujourd\'hui ?',
                'Salut ! Je suis là pour vous assister. Que voulez-vous savoir sur votre stock ?',
                'Bonjour ! Posez-moi n\'importe quelle question sur vos données.',
            ];
            return greets[Math.floor(Math.random() * greets.length)];
        }

        /* ─ Thanks ─ */
        if (/merci|thank|شكرا/.test(q)) {
            return 'Avec plaisir ! 😊 N\'hésitez pas si vous avez d\'autres questions.';
        }

        /* ─ Who are you ─ */
        if (/qui (es-tu|êtes-vous|est)|c\'est quoi|tu es quoi|présente/.test(q)) {
            return '**StockBot AI** 🤖\n\nJe suis votre assistant intelligent intégré à **Gestion Stock**. Je peux analyser vos données en temps réel : produits, clients, fournisseurs, commandes et bien plus encore !';
        }

        /* ─ Help ─ */
        if (/aide|help|que (peux-tu|sais-tu)|quoi faire|fonctionnalités/.test(q)) {
            return 'Voici ce que je peux faire pour vous :\n\n• 📦 **Stock** — Ruptures, niveaux, top produits\n• 👥 **Clients** — Liste, statuts, villes\n• 🚚 **Fournisseurs** — Informations et catégories\n• 🛒 **Panier** — Contenu et totaux\n• 📊 **Statistiques** — Analyses et chiffres clés\n• 💡 **Conseils** — Recommandations métier';
        }

        /* ─ Products — Total ─ */
        if (/(combien|nombre|total).*(produit|article)|(produit|article).*(combien|nombre|total)/.test(q)) {
            if (!products.length) return 'Aucun produit trouvé dans la base.';
            return `📦 Vous avez **${products.length} produits** dans votre catalogue.`;
        }

        /* ─ Products — Stock rupture ─ */
        if (/(rupture|épuisé|stock.*(0|zéro|vide)|out of stock|manquant)/.test(q)) {
            const outOfStock = products.filter(p => Number(p.stock) <= 0);
            if (!outOfStock.length) return '✅ Bonne nouvelle ! Aucun produit en rupture de stock pour le moment.';
            const list = outOfStock.slice(0, 8).map(p => `• **${p.name}** (${p.category})`).join('\n');
            const more = outOfStock.length > 8 ? `\n_...et ${outOfStock.length - 8} autres._` : '';
            return `⚠️ **${outOfStock.length} produit(s) en rupture de stock** :\n\n${list}${more}\n\nPensez à réapprovisionner rapidement !`;
        }

        /* ─ Products — Low stock ─ */
        if (/(stock (faible|bas|critique|alerte)|peu de stock|presque épuisé|≤[0-9]|moins de)/.test(q)) {
            const threshold = 5;
            const low = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= threshold);
            if (!low.length) return `✅ Aucun produit sous le seuil de ${threshold} unités.`;
            const list = low.slice(0, 8).map(p => `• **${p.name}** — ${p.stock} unité(s)`).join('\n');
            return `🟠 **${low.length} produit(s) avec stock faible** (≤${threshold}) :\n\n${list}`;
        }

        /* ─ Products — Most expensive ─ */
        if (/(plus cher|cher|prix (élevé|haut|max|maximum)|coûteux)/.test(q)) {
            if (!products.length) return 'Aucun produit disponible.';
            const sorted = [...products].sort((a, b) => Number(b.price) - Number(a.price));
            const top = sorted.slice(0, 5);
            const list = top.map((p, i) => `${i+1}. **${p.name}** — ${Number(p.price).toFixed(2)} DH`).join('\n');
            return `💰 **Top 5 produits les plus chers** :\n\n${list}`;
        }

        /* ─ Products — Cheapest ─ */
        if (/(moins cher|pas cher|économique|prix (bas|min|minimum)|abordable)/.test(q)) {
            if (!products.length) return 'Aucun produit disponible.';
            const sorted = [...products].sort((a, b) => Number(a.price) - Number(b.price));
            const top = sorted.slice(0, 5);
            const list = top.map((p, i) => `${i+1}. **${p.name}** — ${Number(p.price).toFixed(2)} DH`).join('\n');
            return `💚 **Top 5 produits les moins chers** :\n\n${list}`;
        }

        /* ─ Products — Most stock ─ */
        if (/(plus de stock|meilleur stock|plus en stock|stock (max|élevé|haut|grand))/.test(q)) {
            if (!products.length) return 'Aucun produit disponible.';
            const sorted = [...products].sort((a, b) => Number(b.stock) - Number(a.stock));
            const top = sorted.slice(0, 5);
            const list = top.map((p, i) => `${i+1}. **${p.name}** — ${p.stock} unités`).join('\n');
            return `📦 **Top 5 produits avec le plus de stock** :\n\n${list}`;
        }

        /* ─ Products — List ─ */
        if (/(liste|tous|afficher|montrer|voir).*(produit|article|catalogue)|(produit|article).*(liste|tous|voir|afficher)/.test(q)) {
            if (!products.length) return 'Aucun produit dans le catalogue.';
            const preview = products.slice(0, 8).map(p => `• **${p.name}** — ${Number(p.price).toFixed(2)} DH (Stock: ${p.stock})`).join('\n');
            const more = products.length > 8 ? `\n_...et ${products.length - 8} autres dans le catalogue._` : '';
            return `📋 **Catalogue produits** (${products.length} au total) :\n\n${preview}${more}`;
        }

        /* ─ Products — Search by name ─ */
        if (/(cherche|trouve|search|où est|info sur|détails).*(produit)?/.test(q)) {
            const keywords = q.replace(/(cherche|trouve|search|où est|info sur|détails|produit|le|la|un|une)/g, '').trim();
            if (keywords.length > 2) {
                const found = products.filter(p => p.name.toLowerCase().includes(keywords) || (p.desc || '').toLowerCase().includes(keywords));
                if (found.length) {
                    const list = found.slice(0, 5).map(p =>
                        `• **${p.name}** — ${Number(p.price).toFixed(2)} DH | Stock: ${p.stock} | Catégorie: ${p.category}`
                    ).join('\n');
                    return `🔍 **Résultats pour "${keywords}"** (${found.length} trouvé(s)) :\n\n${list}`;
                }
            }
        }

        /* ─ Categories ─ */
        if (/(catégorie|category|categories|type)/.test(q)) {
            const cats = [...new Set(products.map(p => p.category || 'AUTRE'))].sort();
            if (!cats.length) return 'Aucune catégorie définie.';
            const countByCat = cats.map(c => {
                const count = products.filter(p => p.category === c).length;
                return `• **${c}** — ${count} produit(s)`;
            }).join('\n');
            return `🏷️ **${cats.length} catégorie(s)** :\n\n${countByCat}`;
        }

        /* ─ Clients — Count ─ */
        if (/(combien|nombre|total).*(client|customer)|(client|customer).*(combien|nombre|total)/.test(q)) {
            if (!clients.length) return 'Aucun client enregistré pour le moment.';
            const actifs = clients.filter(c => c.status === 'Actif').length;
            return `👥 Vous avez **${clients.length} client(s)** au total.\n• **${actifs} actif(s)** | ${clients.length - actifs} inactif(s)`;
        }

        /* ─ Clients — List ─ */
        if (/(liste|tous|voir|afficher|montrer).*(client)|(client).*(liste|tous|voir|afficher|montrer)/.test(q)) {
            if (!clients.length) return 'Aucun client enregistré.';
            const preview = clients.slice(0, 8).map(c =>
                `• **${c.name}** — ${c.city || 'N/A'} | ${c.status || 'Actif'}`
            ).join('\n');
            const more = clients.length > 8 ? `\n_...et ${clients.length - 8} autres._` : '';
            return `👥 **Liste des clients** (${clients.length}) :\n\n${preview}${more}`;
        }

        /* ─ Clients — Active ─ */
        if (/(client.*(actif|active)|actif.*(client))/.test(q)) {
            const actifs = clients.filter(c => c.status === 'Actif');
            if (!actifs.length) return 'Aucun client actif.';
            return `✅ **${actifs.length} client(s) actif(s)** sur ${clients.length} au total.`;
        }

        /* ─ Suppliers — Count ─ */
        if (/(combien|nombre|total).*(fournisseur|supplier)|(fournisseur|supplier).*(combien|nombre|total)/.test(q)) {
            if (!suppliers.length) return 'Aucun fournisseur enregistré.';
            return `🚚 Vous travaillez avec **${suppliers.length} fournisseur(s)**.`;
        }

        /* ─ Suppliers — List ─ */
        if (/(liste|tous|voir|afficher|montrer).*(fournisseur|supplier)|(fournisseur|supplier)/.test(q)) {
            if (!suppliers.length) return 'Aucun fournisseur enregistré.';
            const preview = suppliers.slice(0, 8).map(s =>
                `• **${s.name}** — ${s.category || 'N/A'} | Contact: ${s.contact || 'N/A'}`
            ).join('\n');
            const more = suppliers.length > 8 ? `\n_...et ${suppliers.length - 8} autres._` : '';
            return `🚚 **Fournisseurs** (${suppliers.length}) :\n\n${preview}${more}`;
        }

        /* ─ Cart ─ */
        if (/(panier|cart|commande en cours)/.test(q)) {
            if (!cart.length) return '🛒 Votre panier est vide.';
            const products2 = getProducts();
            let items = cart.map(c => {
                const p = products2.find(x => x.id === c.productId);
                return p ? `• **${p.name}** x${c.qty} — ${(Number(p.price) * c.qty).toFixed(2)} DH` : null;
            }).filter(Boolean);
            const total = cart.reduce((s, c) => {
                const p = products2.find(x => x.id === c.productId);
                return s + (p ? Number(p.price) * c.qty : 0);
            }, 0);
            return `🛒 **Panier actuel** (${cart.length} article(s)) :\n\n${items.join('\n')}\n\n**Total: ${total.toFixed(2)} DH**`;
        }

        /* ─ Statistics / Dashboard ─ */
        if (/(stat|statistique|dashboard|tableau de bord|résumé|bilan|aperçu|overview)/.test(q)) {
            const totalStock = products.reduce((s, p) => s + Number(p.stock), 0);
            const ruptures   = products.filter(p => Number(p.stock) <= 0).length;
            const maxPrix    = products.length ? Math.max(...products.map(p => Number(p.price))).toFixed(2) : '0.00';
            const minPrix    = products.length ? Math.min(...products.map(p => Number(p.price))).toFixed(2) : '0.00';
            return `📊 **Résumé du tableau de bord** :\n\n• 📦 **${products.length}** produits\n• 📐 **${totalStock}** unités en stock\n• ⚠️ **${ruptures}** rupture(s)\n• 👥 **${clients.length}** clients\n• 🚚 **${suppliers.length}** fournisseurs\n• 💰 Prix: ${minPrix} → ${maxPrix} DH`;
        }

        /* ─ Value of total stock ─ */
        if (/(valeur|value|montant|capital).*(stock)|(stock).*(valeur|value|montant|capital)/.test(q)) {
            const val = products.reduce((s, p) => s + Number(p.price) * Number(p.stock), 0);
            return `💼 La valeur totale du stock est de **${val.toFixed(2)} DH**.`;
        }

        /* ─ Average price ─ */
        if (/(prix moyen|average price|prix moyen)/.test(q)) {
            if (!products.length) return 'Aucun produit disponible.';
            const avg = products.reduce((s, p) => s + Number(p.price), 0) / products.length;
            return `💲 Le prix moyen de vos produits est de **${avg.toFixed(2)} DH**.`;
        }

        /* ─ City distribution ─ */
        if (/(ville|city|région|zone)/.test(q)) {
            const cities = {};
            clients.forEach(c => { if (c.city) cities[c.city] = (cities[c.city] || 0) + 1; });
            const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]);
            if (!sorted.length) return 'Aucune ville renseignée pour les clients.';
            const list = sorted.slice(0, 6).map(([city, n]) => `• **${city}** — ${n} client(s)`).join('\n');
            return `🗺️ **Répartition des clients par ville** :\n\n${list}`;
        }

        /* ─ Advice / Tips ─ */
        if (/(conseil|astuce|recommandation|tip|suggestion|améliorer|optimiser)/.test(q)) {
            const tips = [];
            const ruptures = products.filter(p => Number(p.stock) <= 0);
            const low = products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5);
            if (ruptures.length) tips.push(`⚠️ Réapprovisionner **${ruptures.length} produit(s) en rupture** au plus vite.`);
            if (low.length) tips.push(`🟠 Surveiller **${low.length} produit(s) à stock faible** (≤5 unités).`);
            if (clients.length > 0) tips.push(`👥 Vous avez **${clients.filter(c=>c.status==='Inactif').length} client(s) inactif(s)** — pensez à les relancer.`);
            if (!tips.length) tips.push('✅ Tout semble en ordre ! Continuez à mettre à jour votre catalogue régulièrement.');
            tips.push('💡 Consultez le module **Diagramme** pour des analyses visuelles approfondies.');
            return `💡 **Conseils & Recommandations** :\n\n${tips.join('\n')}`;
        }

        /* ─ Date/Time ─ */
        if (/(date|heure|aujourd'hui|maintenant|now|quelle heure)/.test(q)) {
            const d = new Date();
            const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
            return `🕐 Nous sommes le **${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}** à **${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}**.`;
        }

        /* ─ Joke ─ */
        if (/(blague|joke|humour|drôle|rigole|amuse)/.test(q)) {
            const jokes = [
                'Pourquoi le gestionnaire de stock ne stresse jamais ? Parce qu\'il a tout **en stock** ! 😄',
                'Un client demande : "Avez-vous ça en stock ?" Le gérant répond : "On a tout... sauf la patience !" 😂',
                'Je voulais faire une blague sur les stocks, mais j\'en suis **à court**. 📦😄',
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        /* ─ Default / Fallback ─ */
        const fallbacks = [
            'Je n\'ai pas bien compris votre demande. Pouvez-vous reformuler ? 🤔\n\nExemples :\n• "Produits en rupture"\n• "Liste des clients"\n• "Résumé du stock"',
            'Je ne suis pas sûr de comprendre. Essayez une de ces questions :\n• "Combien de produits ?"\n• "Fournisseurs actifs"\n• "Valeur du stock"',
            'Hmm, pouvez-vous préciser votre question ? Je gère les données de **stock, clients, fournisseurs et commandes**. 🤖',
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    /* ── Welcome notification after 3s ── */
    setTimeout(() => {
        if (!isOpen && hasUnread) {
            showBadge();
        }
    }, 3000);

})();
