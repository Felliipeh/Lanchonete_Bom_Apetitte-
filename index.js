document.addEventListener('DOMContentLoaded', async () => {
    // ========================================================================
    // 1. Variáveis Globais e Configurações
    // ========================================================================
    
    // Elementos do Cardápio
    const PRODUCTS_GRID = document.getElementById('products');
    const CATEGORIES_NAV = document.getElementById('categoriesNav');
    const SEARCH_INPUT = document.getElementById('searchInput');

    // Elementos do Carrinho (Drawer)
    const CART_FAB = document.getElementById('cartFab');
    const CART_DRAWER = document.getElementById('cartDrawer');
    const CLOSE_DRAWER_BTN = document.getElementById('closeDrawerBtn');
    const CART_COUNT_SPAN = document.getElementById('cartCount');
    const CART_ITEMS_LIST = document.getElementById('cartItemsList');
    const CART_GRAND_TOTAL_SPAN = document.getElementById('cartGrandTotal');
    const CHECKOUT_BTN = document.getElementById('checkoutBtn');
    const EMPTY_CART_MESSAGE = CART_ITEMS_LIST.querySelector('.empty-cart-message');

    // Elementos do Modal de Personalização
    const MODAL = document.getElementById('customModal');
    const MODAL_CLOSE_BTN = document.getElementById('modalCloseBtn');
    const MODAL_TITLE = document.getElementById('modalProductName');
    const MODAL_DESC = document.getElementById('modalProductDesc');
    const MODAL_IMG = document.getElementById('modalProductImg');
    const MODAL_QTY_SPAN = document.getElementById('modalQty');
    const MODAL_TOTAL_SPAN = document.getElementById('modalTotal');
    const MODAL_FORM = document.getElementById('productCustomizationForm');
    const MODAL_OBS = document.getElementById('modalObs');
    const MODAL_CONFIRM_BTN = document.getElementById('modalConfirmBtn');
    const EDITING_ITEM_ID_INPUT = document.getElementById('editingItemId'); 

    // Elementos de Conteúdo das Seções (Injetam o HTML das opções)
    const MODAL_VARIATIONS = document.getElementById('modalVariations');
    const MODAL_ADDITIONALS = document.getElementById('modalAdditionals');
    const MODAL_FLAVORS = document.getElementById('modalFlavors');
    const MODAL_VARIATIONS_SECTION = document.getElementById('modalVariationsSection');
    const MODAL_ADDITIONALS_SECTION = document.getElementById('modalAdditionalsSection');
    const MODAL_FLAVORS_SECTION = document.getElementById('modalFlavorsSection');

    // Elementos do Modal de Checkout
    const CHECKOUT_MODAL = document.getElementById('checkoutModal');
    const CHECKOUT_FORM = document.getElementById('checkoutForm');
    const CHECKOUT_CLOSE_BTN = document.getElementById('checkoutCloseBtn');
    const DELIVERY_FIELDS = document.getElementById('deliveryAddressFields');
    const DELIVERY_OPTIONS = CHECKOUT_FORM.querySelectorAll('input[name="deliveryType"]');
    const ESTABLISHMENT_WHATSAPP = "559881799111"; // Número atualizado do estabelecimento

    // Taxa de Entrega e Checkout
    const BAIRRO_SELECT = document.getElementById('bairro-select');
    const CHECKOUT_TAXA_DISPLAY = document.getElementById('checkoutTaxaDisplay');
    const CHECKOUT_FINAL_TOTAL_DISPLAY = document.getElementById('checkoutFinalTotal');
    const CHECKOUT_GRAND_TOTAL_DISPLAY = document.getElementById('checkoutGrandTotal'); // Subtotal
    
    let deliveryFeesData = [];
    let taxaEntrega = 0;
    let totalComEntrega = 0;
    let productsData = []; 
    let currentCategory = 'Todos';
    let cart = []; 
    let currentProductInModal = null; 
    let currentQty = 1;
    let configFuncionamento = {
        dias_funcionamento: {
            // ... (Configuração Padrão) ...
            "segunda":   { "abertura": 14, "fechamento": 23 },
            "terça":     { "abertura": 10, "fechamento": 23 },
            "quarta":    { "abertura": 10, "fechamento": 23 },
            "quinta":    { "abertura": 10, "fechamento": 23 },
            "sexta":     { "abertura": 10, "fechamento": 23 },
            "sábado":    { "abertura": 10, "fechamento": 23 },
            "domingo":   { "abertura": 10, "fechamento": 23 }
        },
        feriados_fechado: []
    };
    
    // Variáveis do Checkout Step 4 (Troco)
    const payPix = document.getElementById('payPix');
    const payCard = document.getElementById('payCard');
    const payCash = document.getElementById('payCash');
    const trocoField = document.getElementById('trocoField');
    const trocoInput = document.getElementById('trocoInput');

    // ========================================================================
    // 2. Utilidades e Helpers
    // ========================================================================

    /** Formata um número para a moeda brasileira (R$). */
    const formatCurrency = (value) => {
        return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    /** Mostra uma notificação Toast. */
    let toastTimeout;
    const showToast = (message) => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };
    
    /** Converte horário de string (HH:MM) ou número (HH) para minutos totais. */
    function horaParaMinutos(horario) {
        if (typeof horario === 'number') return horario * 60;
        const [h, m] = (horario || '0:0').split(':').map(Number);
        return h * 60 + (m || 0);
    }
    
    // ========================================================================
    // 3. Status de Funcionamento E Lógica de Bloqueio
    // ========================================================================

    async function loadConfigFuncionamento() {
        try {
            const response = await fetch('./config.json');
            configFuncionamento = await response.json();
        } catch (e) {
            console.warn('Não foi possível carregar config.json, usando padrão.', e);
        }
    }

    /**
     * @returns {boolean} True se o estabelecimento estiver dentro do horário de funcionamento.
     */
    function estaAbertoAgora() {
        const agora = new Date();
        const hora = agora.getHours();
        const minuto = agora.getMinutes();
        const diaSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][agora.getDay()];
        const hoje = agora.toISOString().slice(0,10);

        if (configFuncionamento.feriados_fechado && configFuncionamento.feriados_fechado.includes(hoje)) return false;

        const horariosDia = configFuncionamento.dias_funcionamento?.[diaSemana];
        if (!horariosDia) return false;

        const aberturaMin = horaParaMinutos(horariosDia.abertura);
        const fechamentoMin = horaParaMinutos(horariosDia.fechamento);
        const agoraMin = hora * 60 + minuto;
        
        // Trata fechamento após a meia-noite (e.g., abre 22h, fecha 02h)
        if (fechamentoMin < aberturaMin) {
            // Se agora está após a abertura OU antes do fechamento (no dia seguinte)
            return (agoraMin >= aberturaMin) || (agoraMin < fechamentoMin);
        }
        
        return (agoraMin >= aberturaMin && agoraMin < fechamentoMin);
    }

    /** * ATUALIZAÇÃO IMPORTANTE: Esta função não chama mais filterAndRenderProducts().
     * Ela apenas atualiza o status visual e o estado dos botões.
     */
    function atualizarStatusFuncionamento() {
        const estaAberto = estaAbertoAgora();
        const statusDiv = document.getElementById("statusFuncionamento");
        const agora = new Date();
        const diaSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][agora.getDay()];
        const horariosDia = configFuncionamento.dias_funcionamento?.[diaSemana];
        let abertura = horariosDia?.abertura;
        let fechamento = horariosDia?.fechamento;
        let statusHTML = "";
        let horarioInfo = "";

        if (!abertura || !fechamento) {
            statusHTML = `<span class="status-fechado"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> <strong>Fechado</strong></span>`;
            horarioInfo = `Não abrimos hoje`;
        } else if (estaAberto) {
            statusHTML = `<span class="status-aberto"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> <strong>Aberto Agora</strong></span>`;
            horarioInfo = `Fechamos às ${fechamento}`;
        } else {
            const aberturaMin = horaParaMinutos(abertura);
            const fechamentoMin = horaParaMinutos(fechamento);
            const agoraMin = agora.getHours() * 60 + agora.getMinutes();
            if (agoraMin < aberturaMin) {
                // Ainda não abriu hoje
                statusHTML = `<span class="status-fechado"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> <strong>Fechado</strong></span>`;
                horarioInfo = `Abrimos hoje às ${abertura}`;
            } else {
                // Já fechou hoje, procurar próximo dia aberto
                statusHTML = `<span class="status-fechado"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> <strong>Fechado</strong></span>`;
                let proxDia = null;
                let proxAbertura = null;
                let dias = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
                let hojeIdx = agora.getDay();
                for (let i = 1; i <= 7; i++) {
                    let idx = (hojeIdx + i) % 7;
                    let diaNome = dias[idx];
                    let diaConfig = configFuncionamento.dias_funcionamento?.[diaNome];
                    if (diaConfig && diaConfig.abertura && diaConfig.fechamento) {
                        proxDia = diaNome;
                        proxAbertura = diaConfig.abertura;
                        break;
                    }
                }
                if (proxDia && proxAbertura) {
                    let label = (proxDia === dias[(hojeIdx + 1) % 7]) ? "amanhã" : `em ${proxDia}`;
                    horarioInfo = `Abrimos ${label} às ${proxAbertura}`;
                } else {
                    horarioInfo = `Não abrimos nos próximos dias`;
                }
            }
        }
        
        statusDiv.innerHTML = `<div class="status-box">${statusHTML}<span class="horario-info">${horarioInfo}</span></div>`;
        statusDiv.setAttribute('aria-label', `Status de funcionamento: ${estaAberto ? 'Aberto' : 'Fechado'}. ${horarioInfo}`);
        
        // Chamada essencial para atualizar o estado do botão de checkout/carrinho
        updateCartTotals(); 
    }
    
    // ========================================================================
    // 4. Carregamento e Renderização Principal (Cardápio)
    // ========================================================================

    // Persistência: Carregar carrinho e dados do cliente do localStorage
    function loadCartFromStorage() {
        try {
            const storedCart = localStorage.getItem('siriCart');
            if (storedCart) {
                cart = JSON.parse(storedCart);
            }
        } catch (e) { cart = []; }
    }

    function saveCartToStorage() {
        try {
            localStorage.setItem('siriCart', JSON.stringify(cart));
        } catch (e) {}
    }

    function loadClientDataFromStorage() {
        try {
            const storedData = localStorage.getItem('siriClientData');
            if (storedData) {
                const data = JSON.parse(storedData);
                // Preenche campos se existirem
                const form = document.getElementById('checkoutForm');
                if (form) {
                    if (data.name) form.elements['name'].value = data.name;
                    if (data.phone) form.elements['phone'].value = data.phone;
                    if (data.address) form.elements['address'].value = data.address;
                    if (data.bairro) form.elements['bairro'].value = data.bairro;
                    if (data.complement) form.elements['complement'].value = data.complement;
                }
            }
        } catch (e) {}
    }

    function saveClientDataToStorage() {
        try {
            const form = document.getElementById('checkoutForm');
            if (!form) return;
            const data = {
                name: form.elements['name']?.value || '',
                phone: form.elements['phone']?.value || '',
                address: form.elements['address']?.value || '',
                bairro: form.elements['bairro']?.value || '',
                complement: form.elements['complement']?.value || ''
            };
            localStorage.setItem('siriClientData', JSON.stringify(data));
        } catch (e) {}
    }

    async function loadProducts() {
        try {
            await loadConfigFuncionamento();
            const response = await fetch('./data.json'); 
            productsData = await response.json();
            renderCategories();
            atualizarStatusFuncionamento(); 
            filterAndRenderProducts(); // Chamada inicial para carregar o cardápio
            loadCartFromStorage();
            renderCartItems();
        } catch (error) {
            console.error("Erro ao carregar os dados dos produtos:", error);
            PRODUCTS_GRID.innerHTML = '<p class="empty-cart-message">Não foi possível carregar o cardápio. Tente novamente mais tarde.</p>';
        }
    }

    function createProductCard(product) {
        const estaAberto = estaAbertoAgora(); 
        const isEsgotado = product.esgotado === true;
        const isAvailable = product.precoBase > 0 && !isEsgotado;
        const priceFormatted = formatCurrency(product.precoBase);
        const agora = new Date();
        const diaSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][agora.getDay()];
        const horariosDia = configFuncionamento.dias_funcionamento?.[diaSemana];
        const abertura = horariosDia?.abertura ?? '10';
        const aberturaFormatada = String(abertura).includes(':') ? abertura : `${abertura}:00`;
        
        let buttonHTML;
        if (isEsgotado) {
            buttonHTML = `<span class="out-of-stock-btn">Esgotado</span>`;
        } else if (isAvailable && estaAberto) {
            buttonHTML = `<button class="add-btn" data-product-id="${product.id}">Adicionar</button>`;
        } else if (isAvailable && !estaAberto) {
            buttonHTML = `<button class="add-btn closed" disabled>Abre às ${aberturaFormatada}</button>`;
        } else {
            buttonHTML = `<span class="out-of-stock-btn">Esgotado</span>`;
        }

        return `
            <article class="product-card${isEsgotado ? ' esgotado' : ''}" data-product-id="${product.id}" data-category="${product.categoria}">
                <div class="product-card-content">
                    <div class="product-img-wrapper">
                        <img src="${product.imagemUrl}" alt="Imagem de ${product.nome}" class="product-img" loading="lazy" />
                    </div>
                    <div class="product-info">
                        <h3>${product.nome}</h3>
                        <p>${product.descricao}</p>
                        <div class="product-card-footer">
                            <span class="product-price">${priceFormatted}</span>
                            ${buttonHTML}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderSkeletonCards(qtd = 6) {
        let skeletons = '';
        for (let i = 0; i < qtd; i++) {
            skeletons += `
            <article class="skeleton-card">
                <div class="skeleton-img"></div>
                <div class="skeleton-info">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-desc"></div>
                    <div class="skeleton-footer"></div>
                </div>
            </article>`;
        }
        PRODUCTS_GRID.innerHTML = skeletons;
    }

    function filterAndRenderProducts() {
        // Exibe skeletons antes de renderizar os produtos reais
        renderSkeletonCards();
        setTimeout(() => {
            const searchTerm = SEARCH_INPUT.value.trim();
            let filteredProducts = [];
            if (searchTerm.length > 0) {
                // Busca fuzzy com Fuse.js
                const fuse = new Fuse(productsData, {
                    keys: ['nome', 'descricao'],
                    threshold: 0.38,
                    ignoreLocation: true,
                    minMatchCharLength: 2
                });
                let fuseResults = fuse.search(searchTerm);
                filteredProducts = fuseResults.map(r => r.item);
            } else {
                filteredProducts = productsData.slice();
            }
            // Filtro de categoria
            filteredProducts = filteredProducts.filter(product => currentCategory === 'Todos' || product.categoria === currentCategory);
            if (filteredProducts.length === 0) {
                PRODUCTS_GRID.innerHTML = '<p class="empty-cart-message">Nenhum produto encontrado nesta categoria ou busca.</p>';
                return;
            }

            // Agrupar produtos por categoria
            let grouped = {};
            filteredProducts.forEach(prod => {
                if (!grouped[prod.categoria]) grouped[prod.categoria] = [];
                grouped[prod.categoria].push(prod);
            });

            let productsHTML = '';
            // Se estiver em "Todos", mostrar subtítulo de cada categoria
            if (currentCategory === 'Todos') {
                Object.keys(grouped).forEach(cat => {
                    productsHTML += `<div class="category-subtitle"><h3>${cat}</h3></div>`;
                    productsHTML += grouped[cat].map(createProductCard).join('');
                });
            } else {
                // Só mostra os produtos da categoria selecionada, sem subtítulo extra
                productsHTML = filteredProducts.map(createProductCard).join('');
            }

            PRODUCTS_GRID.innerHTML = productsHTML;
            setTimeout(() => {
                document.querySelectorAll('.product-card').forEach(card => {
                    card.classList.add('visible');
                });
            }, 50);
        }, 700); // Duração do skeleton loader (ms)
    }

    function renderCategories() {
        const uniqueCategories = new Set(productsData.map(p => p.categoria));
        const categoriesArray = ['Todos', ...Array.from(uniqueCategories)].filter(c => c);

        CATEGORIES_NAV.innerHTML = categoriesArray.map(category => `
            <button class="category-btn ${category === currentCategory ? 'active' : ''}" 
                    data-category="${category}">
                ${category}
            </button>
        `).join('');
    }

    // ========================================================================
    // 5. Lógica do Modal de Personalização (Adicionar/Editar)
    // ========================================================================

    function openCustomizationModal(productId, itemIdToEdit = null) {
        const product = productsData.find(p => p.id == productId);
        if (!product) return;

        currentProductInModal = product;
        currentQty = 1;
        MODAL_OBS.value = '';
        MODAL_FORM.reset();

        // Placeholder dinâmico para observação
        const categoriasComExemplo = ['Lanches', 'Sanduíches', 'Hambúrguer', 'Porções', 'Macarronada'];
        if (categoriasComExemplo.includes(product.categoria)) {
            MODAL_OBS.placeholder = 'Ex: Sem cebola, pão de alho extra, etc.';
        } else {
            MODAL_OBS.placeholder = 'Observação opcional';
        }

        EDITING_ITEM_ID_INPUT.value = itemIdToEdit || '';
        MODAL_CONFIRM_BTN.textContent = itemIdToEdit ? 'Salvar Alterações' : 'Adicionar ao carrinho';

        MODAL_TITLE.textContent = product.nome;
        MODAL_DESC.textContent = product.descricao;
        MODAL_IMG.src = product.imagemUrl;
        MODAL_IMG.alt = `Imagem de ${product.nome}`;

        renderProductOptions(product);

        if (itemIdToEdit) {
            const itemToEdit = cart.find(item => item.id == itemIdToEdit);
            if (itemToEdit) {
                currentQty = itemToEdit.quantidade;
                MODAL_OBS.value = itemToEdit.observacao || '';

                if (itemToEdit.variacao && itemToEdit.variacao.id) {
                    const varRadio = MODAL_FORM.querySelector(`input[name="variacao"][value="${itemToEdit.variacao.id}"]`);
                    if (varRadio) varRadio.checked = true;
                }

                if (itemToEdit.sabor && itemToEdit.sabor.id) {
                    const flavorRadio = MODAL_FORM.querySelector(`input[name="sabor"][value="${itemToEdit.sabor.id}"]`);
                    if (flavorRadio) flavorRadio.checked = true;
                }

                if (itemToEdit.adicionais && itemToEdit.adicionais.length > 0) {
                    itemToEdit.adicionais.forEach(additional => {
                        const addCheckbox = MODAL_FORM.querySelector(`input[name="adicional"][value="${additional.id}"]`);
                        if (addCheckbox) addCheckbox.checked = true;
                    });
                }
            }
        }

        updateModalTotals();
        MODAL.classList.remove('hidden');
        // Removido: não bloqueia mais o scroll ao abrir o modal de adicionar produto
    }

    function closeModal() {
        MODAL.classList.add('hidden');
        // Removido: não desbloqueia mais o scroll ao fechar o modal de adicionar produto
        currentProductInModal = null;
        currentQty = 1;
        EDITING_ITEM_ID_INPUT.value = ''; 
        MODAL_FORM.reset();
    }
    
    function checkAndReleaseBodyScroll() {
        setTimeout(() => {
            const anyModalOpen = !MODAL.classList.contains('hidden') || 
                                 !CHECKOUT_MODAL.classList.contains('hidden') ||
                                 CART_DRAWER.classList.contains('visible');
            if (!anyModalOpen) {
                document.body.classList.remove('modal-open');
                const scrollY = document.body.dataset.scrollY ? parseInt(document.body.dataset.scrollY, 10) : 0;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                window.scrollTo(0, scrollY);
            }
        }, 100);
    }

    function toggleSection(headerElement) {
        const targetId = headerElement.dataset.target;
        const content = document.querySelector(targetId);
        const icon = headerElement.querySelector('i');

        const shouldExpand = content.classList.contains('expanded');

        if (shouldExpand) {
            content.classList.remove('expanded');
            headerElement.classList.add('collapsed');
            icon.style.transform = 'rotate(0deg)';
        } else {
            content.classList.add('expanded');
            headerElement.classList.remove('collapsed');
            icon.style.transform = 'rotate(180deg)';
        }
    }

    function setSectionState(sectionElement, isAvailable, shouldExpand) {
        if (isAvailable) {
            sectionElement.style.display = 'block';
            const header = sectionElement.querySelector('.section-header');
            const content = sectionElement.querySelector('.section-content');

            if (shouldExpand) {
                content.classList.add('expanded');
                header.classList.remove('collapsed');
                header.querySelector('i').style.transform = 'rotate(180deg)';
            } else {
                content.classList.remove('expanded');
                header.classList.add('collapsed');
                header.querySelector('i').style.transform = 'rotate(0deg)';
            }
        } else {
            sectionElement.style.display = 'none';
        }
    }


    /** Renderiza dinamicamente as opções do produto. */
    function renderProductOptions(product) {
        const options = product.opcoes || {};
        
        MODAL_VARIATIONS.innerHTML = '';
        MODAL_ADDITIONALS.innerHTML = '';
        MODAL_FLAVORS.innerHTML = '';

        // --- Variações (Radio buttons - Obrigatório, abre por padrão)
        const hasVariations = options.variacoes && options.variacoes.length > 0;
        setSectionState(MODAL_VARIATIONS_SECTION, hasVariations, true);

        if (hasVariations) {
            const listHTML = options.variacoes.map((v, index) => `
                <div class="option-item">
                    <input type="radio" id="var-${v.id}" name="variacao" value="${v.id}" data-price="${v.precoAjuste}" ${index === 0 ? 'checked' : ''} required>
                    <label for="var-${v.id}">
                        ${v.nome} 
                        ${v.precoAjuste !== 0 ? `<span class="price-tag">${v.precoAjuste > 0 ? '+' : ''}${formatCurrency(v.precoAjuste)}</span>` : ''}
                    </label>
                </div>
            `).join('');
            MODAL_VARIATIONS.innerHTML = listHTML;
        }

        // --- Sabores (Radio buttons - Exemplo de obrigatório, abre por padrão)
        const hasFlavors = options.sabores && options.sabores.length > 0;
        setSectionState(MODAL_FLAVORS_SECTION, hasFlavors, true);

        if (hasFlavors) {
            const listHTML = options.sabores.map((s, index) => `
                <div class="option-item">
                    <input type="radio" id="flavor-${s.id}" name="sabor" value="${s.id}" ${index === 0 ? 'checked' : ''} required>
                    <label for="flavor-${s.id}">${s.nome}</label>
                </div>
            `).join('');
            MODAL_FLAVORS.innerHTML = listHTML;
        }
        
        // --- Adicionais (Checkboxes - Opcional, fecha por padrão)
        const hasAdditionals = options.adicionais && options.adicionais.length > 0;
        setSectionState(MODAL_ADDITIONALS_SECTION, hasAdditionals, false);
        
        if (hasAdditionals) {
            const listHTML = options.adicionais.map(a => `
                <div class="option-item">
                    <input type="checkbox" id="add-${a.id}" name="adicional" value="${a.id}" data-price="${a.preco}">
                    <label for="add-${a.id}">
                        ${a.nome} 
                        <span class="price-tag">(+${formatCurrency(a.preco)})</span>
                    </label>
                </div>
            `).join('');
            MODAL_ADDITIONALS.innerHTML = listHTML;
        }
    }

    /** Calcula e atualiza os preços do modal. */
    function updateModalTotals() {
        if (!currentProductInModal) return;

        let basePrice = currentProductInModal.precoBase;
        let customizationCost = 0;
        
        const selectedVariation = MODAL_FORM.querySelector('input[name="variacao"]:checked');
        if (selectedVariation) {
            customizationCost += Number(selectedVariation.dataset.price); 
        }

        MODAL_FORM.querySelectorAll('input[name="adicional"]:checked').forEach(checkbox => {
            customizationCost += Number(checkbox.dataset.price);
        });
        
        const finalUnitPrice = basePrice + customizationCost;
        const finalTotal = finalUnitPrice * currentQty;

        MODAL_QTY_SPAN.textContent = currentQty;
        MODAL_TOTAL_SPAN.textContent = formatCurrency(finalTotal);
    }


    /** * Adiciona um item ao carrinho ou ATUALIZA um item existente. */
    function processCartItem(itemIdToUpdate) {
        if (!currentProductInModal) return;

        let basePrice = currentProductInModal.precoBase;
        let customizationCost = 0;

        // 1. Coleta a Variação
        const selectedVariationElement = MODAL_FORM.querySelector('input[name="variacao"]:checked');
        let variationDetails = null;
        if (selectedVariationElement) {
            const variationId = selectedVariationElement.value;
            variationDetails = currentProductInModal.opcoes.variacoes.find(v => v.id === variationId);
            customizationCost += (variationDetails ? variationDetails.precoAjuste : 0);
        }
        
        // 2. Coleta os Adicionais
        const additionalElements = MODAL_FORM.querySelectorAll('input[name="adicional"]:checked');
        let additionalDetails = [];
        additionalElements.forEach(checkbox => {
            const additionalId = checkbox.value;
            const detail = currentProductInModal.opcoes.adicionais.find(a => a.id === additionalId);
            if (detail) {
                additionalDetails.push(detail);
                customizationCost += detail.preco;
            }
        });

        // 3. Coleta o Sabor
        const selectedFlavorElement = MODAL_FORM.querySelector('input[name="sabor"]:checked');
        let flavorDetails = null;
        if (selectedFlavorElement) {
            const flavorId = selectedFlavorElement.value;
            flavorDetails = currentProductInModal.opcoes.sabores.find(s => s.id === flavorId);
        }
        
        // 4. Cria ou Atualiza o item
        const newItemData = {
            productId: currentProductInModal.id,
            nome: currentProductInModal.nome,
            imagemUrl: currentProductInModal.imagemUrl,
            preco: basePrice + customizationCost, // Preço unitário final
            quantidade: currentQty,
            variacao: variationDetails, 
            adicionais: additionalDetails,
            sabor: flavorDetails,
            observacao: MODAL_OBS.value.trim()
        };

        if (itemIdToUpdate) {
            const itemIndex = cart.findIndex(item => item.id == itemIdToUpdate);
            if (itemIndex !== -1) {
                cart[itemIndex] = { ...cart[itemIndex], ...newItemData }; 
                showToast(`"${currentProductInModal.nome}" atualizado!`);
            }
        } else {
            const newItem = {
                id: Date.now(), 
                ...newItemData
            };
            cart.push(newItem);
            showToast(`"${currentProductInModal.nome}" adicionado ao carrinho!`);
        }

        renderCartItems();
        saveCartToStorage();
        closeModal();
    }


    // ========================================================================
    // 6. Lógica do Carrinho (Drawer)
    // ========================================================================

    function openCartDrawer() {
        CART_DRAWER.classList.add('visible');
        if (!document.body.classList.contains('modal-open')) {
            document.body.classList.add('modal-open');
            document.body.dataset.scrollY = window.scrollY;
            document.body.style.top = `-${window.scrollY}px`;
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw';
        }
    }

    function closeCartDrawer() {
        CART_DRAWER.classList.remove('visible');
        checkAndReleaseBodyScroll();
    }

    function updateCartTotals() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
        const grandTotal = cart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
        
        CART_COUNT_SPAN.textContent = totalItems;
        CART_GRAND_TOTAL_SPAN.textContent = formatCurrency(grandTotal);

        const estaAberto = estaAbertoAgora();
        
        // Determina a hora de abertura para exibição na mensagem de fechado
        const agora = new Date();
        const diaSemana = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"][agora.getDay()];
        const horariosDia = configFuncionamento.dias_funcionamento?.[diaSemana];
        const abertura = horariosDia?.abertura ?? '10:00';
        const horarioAbertura = String(abertura).includes(':') ? abertura : `${abertura}:00`;

        if (!estaAberto) {
            CHECKOUT_BTN.disabled = true;
            CHECKOUT_BTN.textContent = `Fechado (Abre às ${horarioAbertura})`;
        } else if (cart.length === 0) {
            CHECKOUT_BTN.disabled = true;
            CHECKOUT_BTN.textContent = 'Adicione itens para finalizar';
        } else {
            CHECKOUT_BTN.disabled = false;
            CHECKOUT_BTN.textContent = 'Finalizar Pedido';
        }
        
        if (EMPTY_CART_MESSAGE) {
            EMPTY_CART_MESSAGE.style.display = cart.length === 0 ? 'block' : 'none';
        }
    }

    function renderCartItems() {
        CART_ITEMS_LIST.innerHTML = '';
        if (cart.length === 0) {
            CART_ITEMS_LIST.appendChild(EMPTY_CART_MESSAGE);
            updateCartTotals();
            saveCartToStorage();
            return;
        }
        const listHTML = cart.map((item) => {
            const itemTotalFormatted = formatCurrency(item.preco * item.quantidade);
            let subDetails = [];
            if (item.variacao && item.variacao.nome) subDetails.push(item.variacao.nome);
            if (item.sabor && item.sabor.nome) subDetails.push(item.sabor.nome);
            if (item.adicionais && item.adicionais.length > 0) {
                subDetails.push('+' + item.adicionais.map(a => a.nome).join(', '));
            }
            if (item.observacao) {
                subDetails.push(`Obs: ${item.observacao}`);
            }
            const detailsHTML = subDetails.map(d => `<p class="cart-item-variation">${d}</p>`).join('');
            return `
                <li class="cart-item" data-item-id="${item.id}">
                    <img src="${item.imagemUrl}" alt="Imagem de ${item.nome}" class="cart-item-img" />
                    <div class="cart-item-details">
                        <p class="cart-item-title">${item.nome}</p>
                        ${detailsHTML}
                        <div class="cart-actions-row">
                            <div class="qty-controls">
                                <button type="button" class="qty-minus" data-action="minus" data-item-id="${item.id}" aria-label="Remover 1 item">-</button>
                                <span class="qty-display" role="status" aria-live="polite">${item.quantidade}</span>
                                <button type="button" class="qty-plus" data-action="plus" data-item-id="${item.id}" aria-label="Adicionar 1 item">+</button>
                            </div>
                            <span class="cart-item-price">${itemTotalFormatted}</span>
                            <div class="cart-item-actions">
                                <button class="cart-item-edit-btn" data-action="edit" data-product-id="${item.productId}" data-item-id="${item.id}">Editar</button>
                                <button class="cart-item-delete-btn" data-action="delete" data-item-id="${item.id}" aria-label="Remover item permanentemente">
                                    <i class="fa-solid fa-trash-alt" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </li>
            `;
        }).join('');
        const ul = document.createElement('ul');
        ul.innerHTML = listHTML;
        CART_ITEMS_LIST.appendChild(ul);
        updateCartTotals();
        saveCartToStorage();
    }

    function handleCartInteractions(event) {
        const target = event.target.closest('button');
        if (!target) return;

        const action = target.dataset.action;
        const itemId = target.dataset.itemId;

        if (!itemId) return;

        const itemIndex = cart.findIndex(item => item.id == itemId);
        if (itemIndex === -1) return;

        if (action === 'plus') {
            cart[itemIndex].quantidade++;
        } else if (action === 'minus') {
            if (cart[itemIndex].quantidade > 1) {
                cart[itemIndex].quantidade--;
            }
        } else if (action === 'delete') {
            const confirmDeletion = confirm(`Tem certeza que deseja remover "${cart[itemIndex].nome}" do seu carrinho?`);
            
            if (confirmDeletion) {
                const removedItem = cart.splice(itemIndex, 1);
                showToast(`"${removedItem[0].nome}" removido!`);
            }

        } else if (action === 'edit') {
            const productId = target.dataset.productId;
            closeCartDrawer(); 
            openCustomizationModal(productId, itemId); 
            return; 
        }
        
        renderCartItems();
        saveCartToStorage();
    }

    // ========================================================================
    // 7. Lógica de Checkout (Múltiplos Passos e WhatsApp)
    // ========================================================================
    
    // --- Lógica de Navegação do Checkout ---
    const steps = [
        document.getElementById('checkoutStep1'),
        document.getElementById('checkoutStep2'),
        document.getElementById('checkoutStep3'),
        document.getElementById('checkoutStep4')
    ];
    const stepDots = document.querySelectorAll('.step-dot');
    const stepBackBtn = document.getElementById('stepBackBtn');
    const stepNextBtn = document.getElementById('stepNextBtn');
    const stepFinishBtn = document.getElementById('stepFinishBtn');
    let currentStep = 0;
    
    // Função auxiliar para sincronizar o total no Step 4
    function syncTotalPagamentoStep() {
        const totalStep3 = document.getElementById('checkoutFinalTotal');
        const totalStep4 = document.getElementById('checkoutFinalTotalPagamento');
        if (totalStep3 && totalStep4) {
            totalStep4.textContent = totalStep3.textContent;
        }
    }
    
    // Lógica para Troco
    function toggleTrocoField() {
        if (payCash && payCash.checked) {
            trocoField.style.display = 'block';
        } else {
            trocoField.style.display = 'none';
            trocoInput.value = '';
            // Limpa o erro/info ao trocar
            const trocoMsg = trocoInput ? trocoInput.parentElement.querySelector('.input-error-msg') : null;
            if (trocoMsg) trocoMsg.textContent = '';
            if (trocoInput) trocoInput.classList.remove('input-error');
        }
    }

    // Lógica para Entrega/Retirada (Step 2)
    const addressInput = document.getElementById('clientAddress');
    const bairroSelect = document.getElementById('bairro-select');

    function updateDeliveryFields() {
        const selected = document.querySelector('input[name="deliveryType"]:checked').value;
        if (selected === 'delivery') {
            DELIVERY_FIELDS.style.opacity = '1';
            addressInput.disabled = false;
            bairroSelect.disabled = false;
            addressInput.required = true;
            bairroSelect.required = true;
        } else {
            DELIVERY_FIELDS.style.opacity = '0.5';
            addressInput.disabled = true;
            bairroSelect.disabled = true;
            addressInput.required = false;
            bairroSelect.required = false;
            taxaEntrega = 0; // Zera a taxa se for retirada
        }
        updateCheckoutTotals(); // Atualiza o total assim que o tipo de entrega muda
    }
    
    function showStep(idx) {
        steps.forEach((step, i) => {
            step.style.display = i === idx ? '' : 'none';
            if (stepDots[i]) {
                stepDots[i].classList.toggle('step-active', i === idx);
            }
        });
        stepBackBtn.style.display = idx === 0 ? 'none' : '';
        stepNextBtn.style.display = idx < steps.length - 1 ? '' : 'none';
        stepFinishBtn.style.display = idx === steps.length - 1 ? '' : 'none';
        
        if (idx === 3) { // Step 4 (Pagamento)
            syncTotalPagamentoStep();
        }
    }

    // Função de Validação do Step para o botão Próximo
    stepNextBtn.addEventListener('click', () => {
        const form = document.getElementById('checkoutForm');
        let valid = true;
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        form.querySelectorAll('.input-error-msg').forEach(el => el.textContent = '');
        
        if (currentStep === 0) { // Step 1: Dados pessoais
            const nameInput = form.elements['name'];
            const phoneInput = form.elements['phone'];
            if (nameInput.value.trim().length <= 2) {
                nameInput.classList.add('input-error');
                let msg = nameInput.parentElement.querySelector('.input-error-msg');
                if (msg) msg.textContent = 'Digite seu nome e sobrenome.';
                valid = false;
            }
            if (phoneInput.value.trim().replace(/\D/g, '').length < 10) { // Verifica 10 ou 11 dígitos
                phoneInput.classList.add('input-error');
                let msg = phoneInput.parentElement.querySelector('.input-error-msg');
                if (msg) msg.textContent = 'Digite um telefone válido.';
                valid = false;
            }
        } else if (currentStep === 1) { // Step 2: Entrega
            const deliveryType = form.elements['deliveryType'].value;
            if (deliveryType === 'delivery') {
                const addressInput = form.elements['address'];
                const bairroInput = form.elements['bairro'];
                if (addressInput.value.trim().length <= 2) {
                    addressInput.classList.add('input-error');
                    let msg = addressInput.parentElement.querySelector('.input-error-msg');
                    if (msg) msg.textContent = 'Digite o endereço para entrega.';
                    valid = false;
                }
                if (!bairroInput.value) {
                    bairroInput.classList.add('input-error');
                    let msg = bairroInput.parentElement.querySelector('.input-error-msg');
                    if (msg) msg.textContent = 'Selecione o bairro.';
                    valid = false;
                }
            }
        } else if (currentStep === 2) {
            // Step 3: Resumo do Pedido - Não precisa de validação de formulário
        } else if (currentStep === 3) { // Step 4: Pagamento
            const paymentInputs = form.querySelectorAll('input[name="paymentMethod"]');
            let paymentSelected = false;
            let isCash = false;
            paymentInputs.forEach(input => {
                if (input.checked) {
                    paymentSelected = true;
                    if (input.value === 'cash') isCash = true;
                }
            });
            
            const paymentGroup = document.querySelector('#checkoutStep4 .radio-group');
            let errorMsg = paymentGroup.querySelector('.input-error-msg');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.className = 'input-error-msg';
                paymentGroup.appendChild(errorMsg);
            }
            if (!paymentSelected) {
                valid = false;
                errorMsg.textContent = 'Selecione uma forma de pagamento.';
            } else {
                errorMsg.textContent = '';
            }

            // Validação do campo Troco (Se for dinheiro)
            let trocoMsg = trocoInput ? trocoInput.parentElement.querySelector('.input-error-msg') : null;
            if (!trocoMsg && trocoInput) {
                trocoMsg = document.createElement('div');
                trocoMsg.className = 'input-error-msg';
                trocoInput.parentElement.appendChild(trocoMsg);
            }
            
            if (isCash && trocoInput) {
                const totalPedido = totalComEntrega; // Usa o total já calculado
                const trocoValue = trocoInput.value.replace(',', '.');
                const trocoNumber = parseFloat(trocoValue);
                
                if (!trocoValue || isNaN(trocoNumber) || trocoNumber <= 0) {
                    valid = false;
                    trocoInput.classList.add('input-error');
                    if (trocoMsg) trocoMsg.textContent = 'Informe o valor para troco.';
                } else if (trocoNumber < totalPedido) {
                    valid = false;
                    trocoInput.classList.add('input-error');
                    if (trocoMsg) trocoMsg.textContent = 'O valor deve ser maior ou igual ao total do pedido.';
                } else {
                    trocoInput.classList.remove('input-error');
                    const trocoReceber = trocoNumber - totalPedido;
                    if (trocoMsg) {
                        if (trocoReceber > 0) {
                            trocoMsg.textContent = `Troco a receber: R$ ${trocoReceber.toFixed(2).replace('.', ',')}`;
                        } else {
                            trocoMsg.textContent = 'Valor exato. Não precisa de troco.';
                        }
                    }
                }
            } else if (trocoMsg) {
                trocoInput.classList.remove('input-error');
                trocoMsg.textContent = '';
            }
        }
        
        if (!valid) {
            showToast('Preencha todos os campos obrigatórios!');
            return;
        }

        if (currentStep < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
        }
    });

    stepBackBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    });

    // --- Lógica de Taxas e Totais ---
    
    async function fetchDeliveryFees() {
        try {
            const response = await fetch('./bairros.json');
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar bairros.json:', error);
            return [];
        }
    }

    function initializeDeliverySelection() {
        if (!BAIRRO_SELECT) return;
        BAIRRO_SELECT.innerHTML = '<option value="">Selecione o bairro</option>';
        deliveryFeesData.forEach(bairro => {
            const opt = document.createElement('option');
            opt.value = bairro.bairro_nome;
            opt.textContent = `${bairro.bairro_nome} (${formatCurrency(bairro.taxa_valor)})`;
            opt.setAttribute('data-taxa', bairro.taxa_valor);
            BAIRRO_SELECT.appendChild(opt);
        });
    }

    function updateCheckoutTotals() {
        const grandSubtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
        let tipoEntrega = 'retirada';
        
        DELIVERY_OPTIONS.forEach(radio => {
            if (radio.checked) tipoEntrega = radio.value;
        });

        if (tipoEntrega === 'delivery' && BAIRRO_SELECT) {
            const selectedOpt = BAIRRO_SELECT.options[BAIRRO_SELECT.selectedIndex];
            // Se nenhum bairro for selecionado, a taxa é zero (e a validação no step 2 deve pegar o erro)
            taxaEntrega = Number(selectedOpt ? selectedOpt.getAttribute('data-taxa') : 0);
        } else {
            taxaEntrega = 0;
        }
        
        totalComEntrega = grandSubtotal + taxaEntrega;
        
        if (CHECKOUT_GRAND_TOTAL_DISPLAY) CHECKOUT_GRAND_TOTAL_DISPLAY.textContent = formatCurrency(grandSubtotal);
        if (CHECKOUT_TAXA_DISPLAY) CHECKOUT_TAXA_DISPLAY.textContent = formatCurrency(taxaEntrega);
        if (CHECKOUT_FINAL_TOTAL_DISPLAY) CHECKOUT_FINAL_TOTAL_DISPLAY.textContent = formatCurrency(totalComEntrega);
    }

    // --- Funções de Modal e Envio (WhatsApp) ---

    function openCheckoutModal() {
        if (!estaAbertoAgora()) {
            showToast('⚠️ O estabelecimento está fechado. Não é possível enviar pedidos agora.');
            return;
        }
        if (cart.length === 0) {
            showToast('Seu carrinho está vazio!');
            return;
        }
        updateCheckoutTotals();
        CHECKOUT_MODAL.classList.remove('hidden');
        if (!document.body.classList.contains('modal-open')) {
            document.body.classList.add('modal-open');
            document.body.dataset.scrollY = window.scrollY;
            document.body.style.top = `-${window.scrollY}px`;
            document.body.style.position = 'fixed';
            document.body.style.width = '100vw';
        }
        closeCartDrawer();
    }

    function closeCheckoutModal() {
        CHECKOUT_MODAL.classList.add('hidden');
        checkAndReleaseBodyScroll();
    }

    function generateWhatsAppMessage() {
        const formData = new FormData(CHECKOUT_FORM);
        const data = Object.fromEntries(formData.entries());
        const grandSubtotal = cart.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

        let nomeEstabelecimento = 'Seu Estabelecimento';
        const brandNameEl = document.querySelector('.brand-name');
        if (brandNameEl) nomeEstabelecimento = brandNameEl.textContent.trim();
        let message = `🛒 *NOVO PEDIDO - ${nomeEstabelecimento}* 🛒\n\n`;

        // 1. DADOS DO CLIENTE
        message += `👤 *Cliente:* ${data.name}\n`;
        message += `📞 *Telefone:* ${data.phone}\n`;

        // 2. ITENS DO PEDIDO
        message += `\n📋 *ITENS DO PEDIDO*\n`;
        cart.forEach((item) => {
            const itemTotal = item.preco * item.quantidade;
            let linhas = [];
            linhas.push(`*${item.quantidade}x* ${item.nome}`);
            if (item.variacao && item.variacao.nome) {
                linhas.push(`  - Variação: ${item.variacao.nome}`);
            }
            if (item.sabor && item.sabor.nome) {
                linhas.push(`  - Sabor: ${item.sabor.nome}`);
            }
            if (item.adicionais && item.adicionais.length > 0) {
                linhas.push(`  - Adicionais: ${item.adicionais.map(a => a.nome).join(', ')}`);
            }
            if (item.observacao) {
                linhas.push(`  - Obs: ${item.observacao}`);
            }
            linhas.push(`  - Total: ${formatCurrency(itemTotal)}`);
            message += linhas.join('\n') + '\n';
        });
        message += `\n-----------------------------`;
        message += `\n💵 *Subtotal:* ${formatCurrency(grandSubtotal)}`;

        // 3. ENTREGA
        message += `\n\n🛵 *ENTREGA*\n`;
        if (data.deliveryType === 'delivery') {
            const bairroSelecionado = BAIRRO_SELECT && BAIRRO_SELECT.value ? BAIRRO_SELECT.options[BAIRRO_SELECT.selectedIndex].textContent.split(' (')[0] : '(não selecionado)';
            message += `- Tipo: Delivery\n`;
            message += `- Bairro: ${bairroSelecionado}\n`;
            message += `- Endereço: ${data.address}${data.complement ? `, ${data.complement}` : ''}\n`;
            message += `- Taxa de Entrega: ${formatCurrency(taxaEntrega)}\n`;
        } else {
            message += `- Tipo: Retirada no Local\n`;
        }

        // 4. PAGAMENTO
        message += `\n💳 *PAGAMENTO*\n`;
        let pagamentoTexto = data.paymentMethod ? data.paymentMethod.toUpperCase() : '';
        if (pagamentoTexto === 'CASH') pagamentoTexto = 'DINHEIRO';
        else if (pagamentoTexto === 'PIX') pagamentoTexto = 'PIX';
        else if (pagamentoTexto === 'CARD') pagamentoTexto = 'CARTÃO';
        message += `- Forma: ${pagamentoTexto}\n`;
        
        if (data.paymentMethod === 'cash') {
            const trocoInput = document.getElementById('trocoInput');
            let trocoValor = trocoInput && trocoInput.value ? trocoInput.value : '';
            if (trocoValor && !isNaN(Number(trocoValor.replace(',', '.')))) {
                const trocoNumero = Number(trocoValor.replace(',', '.'));
                if (trocoNumero > totalComEntrega) {
                    const trocoReceber = trocoNumero - totalComEntrega;
                     message += `- Troco para: ${formatCurrency(trocoNumero)} (Troco: ${formatCurrency(trocoReceber)})\n`;
                } else {
                    message += `- Troco: Não é necessário (Pagamento exato: ${formatCurrency(trocoNumero)})\n`;
                }
            } else {
                 message += `- Troco para: (Valor não informado ou inválido)\n`;
            }
        }

        // 5. TOTAL FINAL
        message += `\n💰 *Total Final:* ${formatCurrency(totalComEntrega)}\n`;

        return encodeURIComponent(message);
    }
    
    // ========================================================================
    // 8. Listeners de Eventos
    // ========================================================================

    // --- Inicialização e Status (Evita recarga do cardápio a cada minuto) ---
    // Apenas a função de status é chamada no loop
    setInterval(atualizarStatusFuncionamento, 60000); 

    // --- Carrinho e Modais ---
    CART_FAB.addEventListener('click', openCartDrawer);
    CLOSE_DRAWER_BTN.addEventListener('click', closeCartDrawer);
    CHECKOUT_BTN.addEventListener('click', openCheckoutModal);
    MODAL_CLOSE_BTN.addEventListener('click', closeModal);
    CHECKOUT_CLOSE_BTN.addEventListener('click', closeCheckoutModal);

    // --- Cardápio, Filtro e Busca ---
    CATEGORIES_NAV.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('category-btn')) {
            currentCategory = target.dataset.category;
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            filterAndRenderProducts();
            // Scroll inteligente após trocar de categoria
            setTimeout(() => {
                const header = document.querySelector('.main-header');
                const categories = document.getElementById('categoriesNav');
                let offset = 0;
                if (header) offset += header.offsetHeight;
                if (categories) offset += categories.offsetHeight;
                // Busca o primeiro card visível
                const firstCard = document.querySelector('.product-card.visible, .product-card');
                if (firstCard) {
                    const cardTop = firstCard.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({
                        top: cardTop - offset - 4, // margem mínima
                        behavior: 'smooth'
                    });
                } else {
                    // fallback: rola até o grid
                    const grid = document.getElementById('products');
                    if (grid) {
                        const gridTop = grid.getBoundingClientRect().top + window.scrollY;
                        window.scrollTo({
                            top: gridTop - offset - 4,
                            behavior: 'smooth'
                        });
                    }
                }
            }, 120);
        }
    });
    // Busca só ao pressionar Enter
    // SEARCH_INPUT.addEventListener('input', filterAndRenderProducts);
    SEARCH_INPUT.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterAndRenderProducts();
            SEARCH_INPUT.blur(); // Fecha o teclado no mobile
        }
    });
    // Permite buscar ao pressionar Enter na barra de busca (mobile e desktop)
    SEARCH_INPUT.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterAndRenderProducts();
            SEARCH_INPUT.blur(); // Fecha o teclado no mobile
        }
    });

    PRODUCTS_GRID.addEventListener('click', (event) => {
        const addButton = event.target.closest('.add-btn');
        if (addButton && !addButton.disabled) {
            const productId = addButton.dataset.productId;
            openCustomizationModal(productId); 
        }
    });
    
    // --- Listeners do Modal de Personalização ---
    MODAL.addEventListener('click', (event) => {
        const target = event.target.closest('.section-header');
        if (target) {
            toggleSection(target);
        }
    });

    document.getElementById('modalQtyPlus').addEventListener('click', () => {
        currentQty++;
        updateModalTotals();
    });

    document.getElementById('modalQtyMinus').addEventListener('click', () => {
        if (currentQty > 1) {
            currentQty--;
            updateModalTotals();
        }
    });

    MODAL_FORM.addEventListener('change', updateModalTotals); // Recálculo ao mudar opções
    
    MODAL_FORM.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemIdToUpdate = EDITING_ITEM_ID_INPUT.value;
        processCartItem(itemIdToUpdate);
    });

    CART_ITEMS_LIST.addEventListener('click', handleCartInteractions);

    // --- Listeners do Checkout (Steps) ---
    // Lógica Troco
    if (payPix) payPix.addEventListener('change', toggleTrocoField);
    if (payCard) payCard.addEventListener('change', toggleTrocoField);
    if (payCash) payCash.addEventListener('change', toggleTrocoField);
    if (trocoInput) {
        // Usa o listener de input para remover erro e mostrar troco a receber (feedback visual)
        trocoInput.addEventListener('input', function() {
            this.classList.remove('input-error');
            const trocoValue = this.value.replace(',', '.');
            const trocoNumber = parseFloat(trocoValue);
            let totalPedido = totalComEntrega; 
            let msg = this.parentElement.querySelector('.input-error-msg');
            if (!msg) {
                msg = document.createElement('div');
                msg.className = 'input-error-msg';
                this.parentElement.appendChild(msg);
            }

            if (!trocoValue || trocoNumber <= 0 || isNaN(trocoNumber)) {
                msg.textContent = '';
            } else if (trocoNumber < totalPedido) {
                msg.textContent = 'Valor insuficiente para o pedido.';
            } else if (trocoNumber === totalPedido) {
                msg.textContent = 'Valor exato do pedido.';
            } else if (trocoNumber > totalPedido) {
                const trocoReceber = trocoNumber - totalPedido;
                msg.textContent = `Troco a receber: R$ ${trocoReceber.toFixed(2).replace('.', ',')}`;
            }
        });
    }
    
    // Lógica Entrega/Bairro
    DELIVERY_OPTIONS.forEach(radio => {
        radio.addEventListener('change', updateDeliveryFields);
    });
    if (BAIRRO_SELECT) {
        BAIRRO_SELECT.addEventListener('change', updateCheckoutTotals);
    }
    
    // Reset do Checkout ao abrir o modal
    const observer = new MutationObserver(() => {
        if (!CHECKOUT_MODAL.classList.contains('hidden')) {
            currentStep = 0;
            showStep(currentStep);
            updateDeliveryFields();
        }
    });
    observer.observe(CHECKOUT_MODAL, { attributes: true, attributeFilter: ['class'] });

    // Envio do formulário de Checkout (Gera o link do WhatsApp)
    CHECKOUT_FORM.addEventListener('submit', (e) => {
        saveClientDataToStorage();
        e.preventDefault();
        // Desabilita botão de envio para evitar múltiplos submits
        const submitBtn = CHECKOUT_FORM.querySelector('button[type="submit"], #stepFinishBtn');
        if (submitBtn) submitBtn.disabled = true;

        if (!estaAbertoAgora()) {
            showToast('❌ O estabelecimento está fechado. Por favor, tente novamente no horário de funcionamento.');
            closeCheckoutModal(); 
            if (submitBtn) submitBtn.disabled = false;
            return; 
        }

        if (cart.length === 0) {
            showToast('Seu carrinho está vazio!');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        // Lógica inteligente: modal só aparece ao finalizar
        const orderConfirmModal = document.getElementById('orderConfirmModal');
        const orderConfirmOkBtn = document.getElementById('orderConfirmOkBtn');
        orderConfirmModal.classList.remove('hidden');
        closeCheckoutModal();
        // Handler para abrir WhatsApp e fechar modal
        const openWhatsAppAndClose = () => {
            const message = generateWhatsAppMessage();
            const numeroLimpo = ESTABLISHMENT_WHATSAPP.replace(/\D/g, "");
            const whatsappURL = `https://wa.me/${numeroLimpo}?text=${message}`;
            window.open(whatsappURL, '_blank');
            cart = [];
            renderCartItems();
            orderConfirmModal.classList.add('hidden');
            if (submitBtn) submitBtn.disabled = false;
        };
        // Remove listeners antigos para evitar duplicidade
        orderConfirmOkBtn.onclick = null;
        orderConfirmModal.onkeydown = null;
        orderConfirmOkBtn.onclick = openWhatsAppAndClose;
        orderConfirmModal.onkeydown = (e) => {
            if (e.key === 'Enter') openWhatsAppAndClose();
        };
    });

    // --- Máscara de Telefone e Input Cleanup ---
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 0) v = '(' + v;
            if (v.length > 3) v = v.slice(0, 3) + ') ' + v.slice(3);
            if (v.length > 10) v = v.slice(0, 10) + '-' + v.slice(10);
            else if (v.length > 9) v = v.slice(0, 9) + '-' + v.slice(9);
            e.target.value = v;
        });
    }

    // Remove feedback visual e mensagem ao digitar/corrigir (exceto Troco, que tem lógica própria)
    const checkoutInputs = document.querySelectorAll('#checkoutForm input:not(#trocoInput), #checkoutForm select');
    checkoutInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('input-error');
            let msg = this.parentElement.querySelector('.input-error-msg');
            if (msg) msg.textContent = '';
            saveClientDataToStorage();
        });
        input.addEventListener('change', function() {
            this.classList.remove('input-error');
            let msg = this.parentElement.querySelector('.input-error-msg');
            if (msg) msg.textContent = '';
            saveClientDataToStorage();
        });
    });
    // Remove erro do troco ao mudar forma de pagamento
    const paymentInputs = document.querySelectorAll('input[name="paymentMethod"]');
    paymentInputs.forEach(input => {
        input.addEventListener('change', function() {
            const trocoInput = document.getElementById('trocoInput');
            if (trocoInput) {
                trocoInput.classList.remove('input-error');
                let trocoMsg = trocoInput.parentElement.querySelector('.input-error-msg');
                if (trocoMsg) trocoMsg.textContent = '';
            }
        });
    });


    // ========================================================================
    // 9. Inicialização Principal
    // ========================================================================
    
    loadCartFromStorage();
    loadClientDataFromStorage();
    await loadProducts();
    deliveryFeesData = await fetchDeliveryFees();
    initializeDeliverySelection();
    updateDeliveryFields(); // Garante o estado inicial dos campos de endereço
    renderCartItems(); // Carrega o carrinho inicialmente (geralmente vazio)

});