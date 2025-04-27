// État de l'application
let manhwaLibrary = [];
let currentTab = 'all';
let currentManhwaId = null;
let chapterInputBuffer = '';
let chapterInputTimeout = null;
const APP_VERSION = '1.5.1';

// Chargement initial
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkFirstVisit();
    checkForUpdates();
});

// Initialisation des écouteurs d'événements
function initEventListeners() {
    // Boutons principaux
    document.getElementById('addButton').addEventListener('click', openAddModal);
    document.getElementById('legalButton').addEventListener('click', () => openModal('legalModal'));
    document.getElementById('searchInput').addEventListener('input', renderLibrary);
    document.getElementById('helpButton').addEventListener('click', () => openModal('helpModal'));
    document.getElementById('helpCloseBtn').addEventListener('click', () => closeModal('helpModal'));
    
    // Écouteurs pour les modals
    document.getElementById('welcomeCloseBtn').addEventListener('click', () => closeModal('welcomeModal'));
    document.getElementById('manhwaForm').addEventListener('submit', handleManhwaFormSubmit);
    document.getElementById('editCancelBtn').addEventListener('click', () => closeModal('editModal'));
    document.getElementById('closeChaptersBtn').addEventListener('click', () => closeModal('chaptersModal'));
    document.getElementById('resetBtn').addEventListener('click', () => openModal('resetProgressModal'));
    document.getElementById('confirmResetBtn').addEventListener('click', confirmResetProgress);
    document.getElementById('cancelResetBtn').addEventListener('click', () => closeModal('resetProgressModal'));
    document.getElementById('legalCloseBtn').addEventListener('click', () => closeModal('legalModal'));
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('updateCloseBtn').addEventListener('click', () => {
        closeModal('updateModal');
        localStorage.setItem('lastViewedVersion', APP_VERSION);
    });
    
    // Écouteurs pour les onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Écouteur pour l'extraction automatique depuis URL
    document.getElementById('readUrlInput').addEventListener('blur', async function() {
        const url = this.value.trim();
        if (!url) return;
        
        // Ajouter une classe pour montrer le chargement
        this.classList.add('loading');
        
        const info = await extractInfoFromUrl(url);
        
        // Enlever la classe de chargement
        this.classList.remove('loading');
        
        if (info) {
            // Remplir automatiquement les champs si on a des infos
            if (info.title && !document.getElementById('titleInput').value.trim()) {
                document.getElementById('titleInput').value = info.title;
            }
            
            if (info.cover && !document.getElementById('coverInput').value.trim()) {
                document.getElementById('coverInput').value = info.cover;
            }
            
            // Ne pas modifier le nombre de chapitres automatiquement
            // Ligne supprimée pour ne pas affecter le champ chaptersInput
        }
    });
    
    // Permettre de fermer le modal en cliquant en dehors du contenu
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Ajouter support pour le swipe sur mobile
    if (isMobileDevice()) {
        let touchStartX = 0;
        let touchEndX = 0;
        
        const library = document.querySelector('.library');
        
        library.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        library.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            const swipeThreshold = 100; // Seuil de déplacement pour déclencher le swipe
            
            if (touchEndX < touchStartX - swipeThreshold) {
                // Swipe vers la gauche (passer à "Terminés")
                if (currentTab === 'all') {
                    showSwipeAnimation('left');
                    setTimeout(() => switchTab('completed'), 150);
                }
            }
            
            if (touchEndX > touchStartX + swipeThreshold) {
                // Swipe vers la droite (passer à "En cours")
                if (currentTab === 'completed') {
                    showSwipeAnimation('right');
                    setTimeout(() => switchTab('all'), 150);
                }
            }
        }
    }
    
    // Détection mobile et resize
    if (isMobileDevice()) {
        enableMobileMode();
    }
    
    // Écouter les changements de taille d'écran
    window.addEventListener('resize', handleResize);
    
    // AJOUT: Raccourcis clavier
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Nouvelle fonction pour gérer les raccourcis clavier
function handleKeyboardShortcuts(e) {
    // Ignorer si on est dans un champ de texte ou un textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Exception pour la touche Échap
        if (e.key === 'Escape') {
            // Fermer les modals ouverts
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'block') {
                    closeModal(modal.id);
                    e.preventDefault();
                }
            });
        }
        return;
    }
    
    // Navigation entre les onglets
    if (e.altKey) {
        if (e.key === '1') {
            // Alt+1: Onglet "En cours"
            switchTab('all');
            e.preventDefault();
        } else if (e.key === '2') {
            // Alt+2: Onglet "Terminés"
            switchTab('completed');
            e.preventDefault();
        }
    }
    
    // Raccourcis sans modificateurs
    switch (e.key) {
        case 'a': // Ajouter un manhwa
        case '+':
            openAddModal();
            e.preventDefault();
            break;
            
        case 's': // Focus sur la recherche
            document.getElementById('searchInput').focus();
            e.preventDefault();
            break;
            
        case 'l': // Mentions légales
            openModal('legalModal');
            e.preventDefault();
            break;
            
        case 'Escape': // Fermer les modals
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'block') {
                    closeModal(modal.id);
                    e.preventDefault();
                }
            });
            break;
    }
    
    // Gestion des chapitres (si un modal de chapitres est ouvert)
    const chaptersModal = document.getElementById('chaptersModal');
    if (chaptersModal && chaptersModal.style.display === 'block') {
        // Touches numériques pour cocher les chapitres
        if (!isNaN(parseInt(e.key))) {
    chapterInputBuffer += e.key; // Ajouter chiffre au buffer

    clearTimeout(chapterInputTimeout); // Reset le timer

    chapterInputTimeout = setTimeout(() => {
        const chapterNumber = parseInt(chapterInputBuffer, 10);
        if (!isNaN(chapterNumber) && chapterNumber > 0) {
            toggleChapter(chapterNumber);
        }
        chapterInputBuffer = ''; // Reset après validation
    }, 500); // 0.5 seconde d'attente après la dernière touche

    e.preventDefault();
}

        // Réinitialisation de la progression
        if (e.key === 'r') {
            openModal('resetProgressModal');
            e.preventDefault();
        }
    }
}

// Vérification première visite
function checkFirstVisit() {
    if (!localStorage.getItem('hasVisited')) {
        openModal('welcomeModal');
        localStorage.setItem('hasVisited', 'true');
    }
    loadLibrary();
    updateVersionDisplay(); // Ajoutez cette ligne
}

// Vérification des mises à jour
function checkForUpdates() {
    const lastViewedVersion = localStorage.getItem('lastViewedVersion');
    
    // Si c'est la première fois ou si la version a changé
    if (!lastViewedVersion || lastViewedVersion !== APP_VERSION) {
        // Définir le contenu des mises à jour
        const updateContent = document.getElementById('updateContent');
        
        // Obtenir les notes de mise à jour
        const updateInfo = getUpdateInfoObject(APP_VERSION);
        updateContent.innerHTML = getUpdateNotes(APP_VERSION, lastViewedVersion);
        
        // Envoyer une notification à Discord (mais pas lors de la première installation)
        if (lastViewedVersion) {
            sendDiscordNotification(APP_VERSION, updateInfo);
        }
        
        // Ouvrir le modal une fois que le reste de la page est chargé
        setTimeout(() => {
            openModal('updateModal');
        }, 500);
    }
}

// Fonction pour obtenir uniquement l'objet d'information de mise à jour
function getUpdateInfoObject(version) {
    // Structure des notes de mise à jour basée sur les versions
    const updates = {
        '1.4.0': {
             date: '28 avril 2025',
             features: [
                 'Ajour de raccoucris clavier',
                 'Modification du style du profil',
                 'Correction de quelques bugs'
             ]
         },
        '1.3.4': {
             date: '27 avril 2025',
             features: [
                 'Restructuration du code du profil',
                 'Modification complete du style du site'
             ]
         },
        '1.3.2': {
             date: '16 avril 2025',
             features: [
                 'Correction des bugs tu profil + Amelioration du style',
                 'Ajout de fonctionnalite du bot discord (ping mise a jour)'
             ]
         },
        '1.3.1': {
             date: '15 avril 2025',
             features: [
                 'Correction du bouton Lire pour les liens Phenix Scans – il fonctionne désormais correctement',
                 'Ajout d\'un style spécial pour les téléphones : meilleure lisibilité et affichage plus adapté aux petits écrans'
             ]
         },
        '1.2.0': {
            date: '13 avril 2025',
            features: [
                'Ajout des favoris: marquez vos manhwas préférés avec une étoile. Les favoris apparaissent maintenant en haut de la liste',
                'Extraction automatique des informations depuis les URLs',
                'Reglage des bugs'
            ]
        },
        '1.1.0': {
            date: '20 mars 2025',
            features: [
                'Amélioration de l\'interface sur mobile',
                'Ajout de la recherche par titre',
                'Correction de bugs mineurs sur la progression'
            ]
        },
        '1.0.0': {
            date: '15 février 2025',
            features: [
                'Première version stable',
                'Suivi de progression de lecture',
                'Interface adaptative'
            ]
        }
    };
    
    return updates[version] || { 
        date: 'Aujourd\'hui', 
        features: ['Améliorations et corrections de bugs']
    };
}

// Récupérer les notes de mise à jour en fonction de la version
function getUpdateNotes(currentVersion, previousVersion) {
    // Structure des notes de mise à jour basée sur les versions
    const updates = {
        '1.4.0': {
             date: '28 avril 2025',
             features: [
                 'Ajour de raccoucris clavier',
                 'Modification du style du profil',
                 'Correction de quelques bugs'
             ]
         },
        '1.3.4': {
             date: '27 avril 2025',
             features: [
                 'Restructuration du code du profil',
                 'Modification complete du style du site'
             ]
         },
        '1.3.2': {
             date: '16 avril 2025',
             features: [
                 'Correction des bugs tu profil + Amelioration du style',
                 'Ajout de fonctionnalite du bot discord (ping mise a jour)'
             ]
         },
        '1.3.1': {
             date: '15 avril 2025',
             features: [
                 'Correction du bouton <strong>Lire</strong> pour les liens <strong>Phenix Scans</strong> – il fonctionne désormais correctement',
                 'Ajout d\'un <strong>style spécial pour les téléphones</strong> : meilleure lisibilité et affichage plus adapté aux petits écrans'
             ]
         },
        '1.2.0': {
            date: '13 avril 2025',
            features: [
                'Ajout des favoris: marquez vos manhwas préférés avec une étoile,<br>Les favoris apparaissent maintenant en haut de la liste',
                'Extraction automatique des informations depuis les URLs',
                'Reglage des bugs'
            ]
        },
        '1.1.0': {
            date: '20 mars 2025',
            features: [
                'Amélioration de l\'interface sur mobile',
                'Ajout de la recherche par titre',
                'Correction de bugs mineurs sur la progression'
            ]
        },
        '1.0.0': {
            date: '15 février 2025',
            features: [
                'Première version stable',
                'Suivi de progression de lecture',
                'Interface adaptative'
            ]
        }
    };
    
    let html = '';
    
    // Si c'est une mise à jour (pas la première installation)
    if (previousVersion) {
        html += `<p class="update-info">Mise à jour de la version ${previousVersion} vers ${currentVersion}</p>`;
    }
    
    // Obtenir la dernière version ou la version actuelle
    const versionInfo = updates[currentVersion] || { 
        date: 'Aujourd\'hui', 
        features: ['Améliorations et corrections de bugs']
    };
    
    html += `
        <div class="update-notes">
            <p class="update-date">Version ${currentVersion} - ${versionInfo.date}</p>
            <ul class="feature-list">
                ${versionInfo.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
        </div>
    `;
    
    return html;
}

// Gestion du stockage local
function saveLibrary() {
    const libraryData = manhwaLibrary.map(manhwa => ({
        ...manhwa,
        readChapters: Array.from(manhwa.readChapters)
    }));
    localStorage.setItem('manhwaLibrary', JSON.stringify(libraryData));
}

function loadLibrary() {
    const saved = localStorage.getItem('manhwaLibrary');
    if (saved) {
        try {
            manhwaLibrary = JSON.parse(saved).map(manhwa => ({
                ...manhwa,
                readChapters: new Set(manhwa.readChapters || []),
                isFavorite: manhwa.isFavorite || false // Ajouter cette ligne
            }));
        } catch (error) {
            console.error("Erreur lors du chargement de la bibliothèque:", error);
            manhwaLibrary = [];
        }
    }
    renderLibrary();
}

// Création d'une carte manhwa
// Modifiez createManhwaCard pour ajouter l'étoile de favori
function createManhwaCard(manhwa) {
    const progress = manhwa.totalChapters > 0 ? (manhwa.readChapters.size / manhwa.totalChapters) * 100 : 0;
    const nextChapter = getNextUnreadChapter(manhwa);
    const readUrl = buildReadUrl(manhwa.readUrl, nextChapter);

    const card = document.createElement('div');
    card.className = 'manhwa-card';
    if (manhwa.isFavorite) {
        card.classList.add('favorite');
    }
    
    card.innerHTML = `
        <div class="edit-buttons">
            <button class="favorite-button ${manhwa.isFavorite ? 'active' : ''}" title="${manhwa.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">⭐</button>
            <button class="edit-button" title="Modifier">✏️</button>
            <button class="delete-button" title="Supprimer">🗑️</button>
        </div>
        <div class="cover-container">
            <img src="${manhwa.cover || '/api/placeholder/200/280'}" alt="${manhwa.title}" class="cover-image">
        </div>
        <div class="manhwa-info">
            <h3 class="manhwa-title">${manhwa.title}</h3>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill ${progress === 100 ? 'animated' : ''}" style="width: ${progress}%"></div>
                </div>
                <div class="chapter-info">
                    <span>${manhwa.readChapters.size}/${manhwa.totalChapters} chapitres</span>
                    <a href="${readUrl}" target="_blank" class="read-button">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                            <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
                        </svg>
                        Lire
                    </a>
                </div>
            </div>
        </div>
    `;

    // Ajout des gestionnaires d'événements
    card.querySelector('.favorite-button').addEventListener('click', (e) => {
        toggleFavorite(manhwa.id, e);
    });
    
    card.querySelector('.edit-button').addEventListener('click', (e) => {
        e.stopPropagation();
        editManhwa(manhwa.id);
    });
    
    card.querySelector('.delete-button').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(manhwa.id);
    });
    
    card.querySelector('.read-button').addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    card.addEventListener('click', () => openChapters(manhwa.id));
    
    return card;
}

// Rendu de la bibliothèque
// Modifiez la fonction renderLibrary pour mettre les favoris en premier
function renderLibrary() {
    const library = document.getElementById('library');
    library.innerHTML = '';

    let filteredManhwa = manhwaLibrary;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    // Filtrage par recherche
    if (searchTerm) {
        filteredManhwa = filteredManhwa.filter(m => 
            m.title.toLowerCase().includes(searchTerm)
        );
    }

    // Filtrage par onglet
    if (currentTab === 'completed') {
        filteredManhwa = filteredManhwa.filter(m => 
            m.readChapters.size === m.totalChapters && m.totalChapters > 0
        );
    } else {
        filteredManhwa = filteredManhwa.filter(m => 
            m.readChapters.size < m.totalChapters
        );
    }

    // Trier les favoris en premier
    filteredManhwa.sort((a, b) => {
        // D'abord par favori (favoris en premier)
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        
        // Ensuite par titre
        return a.title.localeCompare(b.title);
    });

    // Message si la bibliothèque est vide
    if (filteredManhwa.length === 0) {
        const message = searchTerm 
            ? 'Aucun manhwa trouvé pour cette recherche' 
            : currentTab === 'completed' 
                ? 'Aucun manhwa terminé pour le moment' 
                : 'Ajoutez votre premier manhwa en cliquant sur le bouton +';
                
        library.innerHTML = `<div class="empty-state">${message}</div>`;
        return;
    }

    // Ajout des cartes
    filteredManhwa.forEach(manhwa => {
        library.appendChild(createManhwaCard(manhwa));
    });
}

// Gestion des chapitres
function openChapters(id) {
    const manhwa = manhwaLibrary.find(m => m.id === id);
    if (!manhwa) return;
    
    currentManhwaId = id;
    document.getElementById('chaptersTitle').textContent = manhwa.title;

    const grid = document.getElementById('chaptersGrid');
    grid.innerHTML = '';

    for (let i = 1; i <= manhwa.totalChapters; i++) {
        const chapter = document.createElement('div');
        chapter.className = `chapter-item ${manhwa.readChapters.has(i) ? 'read' : ''}`;
        chapter.textContent = i;
        chapter.addEventListener('click', () => toggleChapter(i));
        grid.appendChild(chapter);
    }

    openModal('chaptersModal');
}

// Fonction pour basculer l'état d'un chapitre
function toggleChapter(chapterNumber) {
    const manhwa = manhwaLibrary.find(m => m.id === currentManhwaId);
    if (!manhwa) return;
    
    const isCurrentlyRead = manhwa.readChapters.has(chapterNumber);
    
    if (isCurrentlyRead) {
        // Désélection des chapitres jusqu'à celui cliqué
        for (let i = chapterNumber; i <= manhwa.totalChapters; i++) {
            manhwa.readChapters.delete(i);
        }
    } else {
        // Sélection des chapitres jusqu'à celui cliqué
        for (let i = 1; i <= chapterNumber; i++) {
            manhwa.readChapters.add(i);
        }
    }

    saveLibrary();
    renderLibrary();
    
    // Mise à jour de l'affichage des chapitres
    const chaptersGrid = document.getElementById('chaptersGrid');
    const chapterItems = chaptersGrid.querySelectorAll('.chapter-item');
    
    chapterItems.forEach((item, index) => {
        const chapterNum = index + 1;
        item.classList.toggle('read', manhwa.readChapters.has(chapterNum));
    });
}

// Ajoutez cette fonction après toggleChapter
function toggleFavorite(id, event) {
    event.stopPropagation(); // Éviter de propager au parent (ouverture des chapitres)
    
    const manhwa = manhwaLibrary.find(m => m.id === id);
    if (!manhwa) return;
    
    manhwa.isFavorite = !manhwa.isFavorite;
    
    saveLibrary();
    renderLibrary();
}

// Fonction pour obtenir le prochain chapitre non lu
function getNextUnreadChapter(manhwa) {
    for (let i = 1; i <= manhwa.totalChapters; i++) {
        if (!manhwa.readChapters.has(i)) {
            return i;
        }
    }
    return manhwa.totalChapters; // Retourne le dernier chapitre si tout est lu
}

// Fonction pour construire l'URL de lecture
function buildReadUrl(baseUrl, chapterNumber) {
    if (!baseUrl) return '#';
    
    try {
        // Vérifier si c'est une URL de Phenix Scans
        if (baseUrl.includes('phenix-scans.com')) {
            // Extraire le nom du manhwa depuis l'URL
            const urlObj = new URL(baseUrl);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            // Format attendu: /manga/nom-du-manhwa/
            if (pathParts.length >= 2 && pathParts[0] === 'manga') {
                const manhwaName = pathParts[1];
                // Construire la nouvelle URL selon le format: /manga/nom-du-manhwa/chapitre/numero
                return `https://phenix-scans.com/manga/${manhwaName}/chapitre/${chapterNumber}`;
            }
        }
        
        // Conserver le comportement existant pour les autres sites
        // Nettoyer l'URL
        const cleanUrl = baseUrl.replace(/\/+$/, '');
        const urlWithoutManga = cleanUrl.replace('/manga/', '/');
        
        // Extraire les parties de l'URL
        const urlParts = urlWithoutManga.split('/');
        const title = urlParts.pop() || '';
        const urlBase = urlParts.join('/');
        
        // Construire l'URL finale
        return `${urlBase}/${title}-chapitre-${chapterNumber}/`;
    } catch (error) {
        console.error("Erreur lors de la construction de l'URL:", error);
        return baseUrl;
    }
}

// Ajoutez cette fonction après la fonction buildReadUrl
async function extractInfoFromUrl(url) {
    if (!url) return null;
    
    try {
        // Vérifier si l'URL est valide
        new URL(url);
        
        // Préparer les données à retourner
        const result = {
            title: '',
            cover: '',
            totalChapters: 0,
            readUrl: url
        };

        // Extraire le titre depuis l'URL
        if (url.includes('phenix-scans.com')) {
            // Format phenix-scans: https://phenix-scans.com/manga/nom-du-manhwa/
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            
            if (pathParts.length >= 2 && pathParts[0] === 'manga') {
                // Convertir le slug en titre lisible
                const rawTitle = pathParts[1];
                result.title = rawTitle
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase()); // Capitaliser chaque mot
                
                // Pour récupérer le nombre de chapitres, on pourrait faire une requête 
                // mais comme on est côté client, on propose une valeur par défaut
                result.totalChapters = 100; // Valeur par défaut
                
                // L'image de couverture ne peut pas être récupérée sans faire une requête au site
                result.cover = '';
            }
        }
        
        return result;
    } catch (error) {
        console.error("Erreur lors de l'extraction des informations:", error);
        return null;
    }
}

// Gestion des modals
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden'; // Empêcher le défilement
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = ''; // Rétablir le défilement
    
    if (modalId === 'editModal') {
        document.getElementById('manhwaForm').reset();
        currentManhwaId = null;
    }
}

// Ouverture du modal d'ajout
function openAddModal() {
    currentManhwaId = null;
    document.getElementById('modalTitle').textContent = 'Ajouter un manhwa';
    document.getElementById('manhwaForm').reset();
    openModal('editModal');
}

// Édition d'un manhwa
function editManhwa(id) {
    const manhwa = manhwaLibrary.find(m => m.id === id);
    if (!manhwa) return;
    
    currentManhwaId = id;
    document.getElementById('modalTitle').textContent = 'Modifier le manhwa';
    document.getElementById('titleInput').value = manhwa.title;
    document.getElementById('coverInput').value = manhwa.cover || '';
    document.getElementById('readUrlInput').value = manhwa.readUrl || '';
    document.getElementById('chaptersInput').value = manhwa.totalChapters;
    
    openModal('editModal');
}

// Suppression d'un manhwa
function openDeleteModal(id) {
    currentManhwaId = id;
    openModal('deleteModal');
}

function confirmDelete() {
    if (currentManhwaId === null) return;
    
    manhwaLibrary = manhwaLibrary.filter(m => m.id !== currentManhwaId);
    saveLibrary();
    renderLibrary();
    closeModal('deleteModal');
    currentManhwaId = null;
}

// Réinitialisation de la progression
function confirmResetProgress() {
    const manhwa = manhwaLibrary.find(m => m.id === currentManhwaId);
    if (!manhwa) return;
    
    manhwa.readChapters = new Set();
    saveLibrary();
    renderLibrary();
    
    // Mise à jour de l'affichage des chapitres
    const chaptersGrid = document.getElementById('chaptersGrid');
    chaptersGrid.querySelectorAll('.chapter-item').forEach(item => {
        item.classList.remove('read');
    });
    
    closeModal('resetProgressModal');
}

// Traitement du formulaire d'ajout/modification
// Modifiez la fonction handleManhwaFormSubmit pour ajouter le champ favoris
function handleManhwaFormSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('titleInput').value.trim();
    const cover = document.getElementById('coverInput').value.trim();
    const readUrl = document.getElementById('readUrlInput').value.trim();
    const totalChapters = parseInt(document.getElementById('chaptersInput').value) || 0;

    if (!title || totalChapters <= 0) {
        alert("Veuillez remplir tous les champs correctement.");
        return;
    }

    if (currentManhwaId) {
        // Mode édition
        const index = manhwaLibrary.findIndex(m => m.id === currentManhwaId);
        if (index !== -1) {
            const existingReadChapters = manhwaLibrary[index].readChapters;
            const newReadChapters = new Set(
                [...existingReadChapters].filter(ch => ch <= totalChapters)
            );
            
            // Conserver le statut de favori s'il existe déjà
            const isFavorite = manhwaLibrary[index].isFavorite || false;

            manhwaLibrary[index] = {
                id: currentManhwaId,
                title,
                cover,
                readUrl,
                totalChapters,
                readChapters: newReadChapters,
                isFavorite: isFavorite
            };
        }
    } else {
        // Mode ajout
        manhwaLibrary.push({
            id: Date.now(),
            title,
            cover,
            readUrl,
            totalChapters,
            readChapters: new Set(),
            isFavorite: false
        });
    }

    saveLibrary();
    renderLibrary();
    closeModal('editModal');
}

// Changement d'onglet
function switchTab(tab) {
    if (!tab || (tab !== 'all' && tab !== 'completed')) return;
    
    currentTab = tab;
    
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    renderLibrary();
}

// Met à jour l'affichage de la version dans l'interface
function updateVersionDisplay() {
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
        versionElement.textContent = APP_VERSION;
    }
}

// Détection des appareils mobiles
function isMobileDevice() {
    return (window.innerWidth <= 768) || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Activer le mode téléphone
function enableMobileMode() {
    document.body.classList.add('mobile-mode');
    
    // Ajuster l'interface pour le mobile
    adjustUIForMobile();
}

// Ajuster l'interface pour mobile
function adjustUIForMobile() {
    // Réduire le nombre de cartes par ligne
    const library = document.querySelector('.library');
    if (library) {
        library.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
    }
    
    // Rendre les boutons d'action toujours visibles
    const editButtons = document.querySelectorAll('.edit-buttons');
    editButtons.forEach(btn => {
        btn.style.opacity = '1';
    });
    
    // Ajuster la taille des modals
    const modalContents = document.querySelectorAll('.modal-content');
    modalContents.forEach(modal => {
        modal.style.width = '90%';
    });
}

// Fonction pour gérer le redimensionnement de la fenêtre
function handleResize() {
    if (isMobileDevice()) {
        enableMobileMode();
    } else {
        document.body.classList.remove('mobile-mode');
        resetUIForDesktop();
    }
}

// Réinitialiser l'interface pour ordinateur
function resetUIForDesktop() {
    const library = document.querySelector('.library');
    if (library) {
        library.style.gridTemplateColumns = '';
    }
    
    const editButtons = document.querySelectorAll('.edit-buttons');
    editButtons.forEach(btn => {
        btn.style.opacity = '';
    });
    
    const modalContents = document.querySelectorAll('.modal-content');
    modalContents.forEach(modal => {
        modal.style.width = '';
    });
}

// Fonction pour afficher l'animation pendant le swipe
function showSwipeAnimation(direction) {
    const library = document.querySelector('.library');
    library.style.opacity = '0.6';
    
    setTimeout(() => {
        library.style.opacity = '1';
    }, 300);
    
    // Montrer temporairement une indication de direction
    const swipeIndicator = document.createElement('div');
    swipeIndicator.className = 'swipe-indicator';
    swipeIndicator.textContent = direction === 'left' ? '→ Terminés' : '← En cours';
    document.body.appendChild(swipeIndicator);
    
    setTimeout(() => {
        document.body.removeChild(swipeIndicator);
    }, 800);
}

// Fonction pour envoyer une notification à Discord
async function sendDiscordNotification(version, updateInfo) {
    const webhookUrl = "https://discord.com/api/webhooks/1353243772388905070/1S7zjS96Nc57HWtgJ-Jn3MiFUXkp9urwZDwsXNb71Wnz_Oya9ZgE7Ztu4jVr9An5IYbz";
    
    try {
        const features = updateInfo.features.map(feature => `- ${feature}`).join('\n');
        
        const payload = {
            embeds: [{
                title: `🚀 Mise à jour IXWHA v${version}`,
                description: `Une nouvelle version de IXWHA est disponible !`,
                color: 3447003, // Couleur bleue
                fields: [
                    {
                        name: "Version",
                        value: version,
                        inline: true
                    },
                    {
                        name: "Date",
                        value: updateInfo.date,
                        inline: true
                    },
                    {
                        name: "Nouveautés",
                        value: features
                    }
                ],
                footer: {
                    text: "IXWHA - Bibliothèque Manhwa"
                },
                timestamp: new Date().toISOString()
            }]
        };
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Erreur Discord: ${response.statusText}`);
        }
        
        console.log("Notification Discord envoyée avec succès");
    } catch (error) {
        console.error("Erreur lors de l'envoi de la notification Discord:", error);
    }
}
