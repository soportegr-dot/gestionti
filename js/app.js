/* ==========================================================================
           1. ESTADO INICIAL, PERSISTENCIA Y SINCRONIZACIÓN EN TIEMPO REAL
           ========================================================================== */
        const STORAGE_KEY = 'upfr_ti_system_prod_v1';
        const syncChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('oti_upfr_sync') : null;

        function getAvatarUrl(name, bg = '910048') {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=ffffff&bold=true&size=128`;
        }

        const defaultState = {
            users: [
                {
                    id: 'u_admin',
                    username: 'admin',
                    password: '123',
                    name: 'Administrador TI',
                    role: 'admin',
                    avatar: getAvatarUrl('Administrador TI', '910048')
                },
                {
                    id: 'u_tech',
                    username: 'tecnico',
                    password: '123',
                    name: 'Técnico TI',
                    role: 'tech',
                    avatar: getAvatarUrl('Tecnico TI', '141829')
                }
            ],
            htmlTemplate: {
                headerTitle: 'CONFIRMADO',
                headerSubtitle: '¡Tu solicitud ha sido recibida!',
                primaryColor: '#910048',
                ticketIntro: 'Se confirma que su ticket de atención técnica ha sido procesado de manera exitosa. Nuestro equipo de soporte ha registrado su atención con los siguientes detalles:',
                ticketNote: 'Nota importante: Si requiere seguimiento adicional sobre esta atención, comuníquese con la Oficina de Tecnologías de la Información.',
                eventIntro: 'Se confirma que su requerimiento ha sido procesado de manera exitosa. El ambiente y equipos solicitados ya se encuentran reservados y agendados con los siguientes detalles:',
                eventNote: 'Nota importante: El ambiente estará completamente preparado y listo 30 minutos antes de lo previsto para la ejecución de su evento.',
                meetIntro: 'Se confirma que la asignación de su licencia institucional de Google Meet ha sido procesada de manera exitosa con los siguientes detalles:',
                meetNote: 'Nota importante: Recuerde utilizar la licencia únicamente dentro del periodo autorizado. Al finalizar la fecha indicada se procederá con el retiro automático.',
                footerClosing: 'Ante cualquier inconveniente agradecemos que nos lo comunique con anticipación, al igual que cualquier requerimiento adicional para poder solucionarlo a tiempo.',
                footerOrg: 'Oficina de Tecnologías de la Información',
                footerUni: 'Universidad Privada Franklin Roosevelt',
                footerAddress: 'Av. Giráldez 542, Huancayo - Perú',
                footerPhone: '983485730'
            },
            catalogs: {
                canales: ['wtsp', 'fb', 'correo'],
                campus: ['Arequipa', 'Jauja', 'Lima'],
                lugares: ['Salón', 'Oficina', 'Otros'],
                colaboradores: ['Docente', 'Administrativo', 'Cocinero', 'Lavandero'],
                servicios: ['Licencia Meet', 'Recarga de tinta/toner', 'Restablecer accesos', 'Aula Virtual', 'Otro'],
                modelosTinta: ['Toner HP 85A', 'Tinta Epson 544 Negro', 'Tinta Epson 544 Color', 'Toner Brother TN-1060'],
                prioridades: ['MASO', 'ALTA'],
                estados: ['YA TA', 'FALTA POCO', 'RESUELTO'],
                tiposEvento: ['Sustentación', 'Baile', 'Cumpleaños', 'Conferencia', 'Taller'],
                escuelas: ['EP. Derecho', 'EP. de Medicina', 'EP. Ingeniería de Sistemas', 'EP. Administración'],
                equipos: ['MICROFONO', 'PARLANTE', 'OTROS', 'CONSOLA DE SONIDO', 'PROYECTOR']
            },
            inks: [],
            tickets: [],
            events: [],
            meetLicensesTotal: 100,
            meetLicenses: []
        };

        function cloneDefaultState() {
            return JSON.parse(JSON.stringify(defaultState));
        }

        function loadState() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    const fresh = cloneDefaultState();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
                    return fresh;
                }
                const parsed = JSON.parse(raw);
                return {
                    ...cloneDefaultState(),
                    ...parsed,
                    htmlTemplate: { ...defaultState.htmlTemplate, ...(parsed.htmlTemplate || {}) },
                    catalogs: { ...defaultState.catalogs, ...(parsed.catalogs || {}) }
                };
            } catch (err) {
                console.error('Error cargando estado:', err);
                return cloneDefaultState();
            }
        }

        let appState = loadState();
        let currentUser = null;
        let activeView = 'dashboard';
        let chartInstances = {};
        let selectedAvatarDataUrl = '';
        let avatarTargetUserId = null;
        let lastGeneratedHtml = '';
        let lastGeneratedCaptureName = 'comprobante_oti';

        function saveState(broadcast = true) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
                if (broadcast && syncChannel) {
                    syncChannel.postMessage({ type: 'STATE_UPDATED', timestamp: Date.now() });
                }
            } catch (err) {
                console.error('Error guardando estado:', err);
                showToast('No se pudo guardar en almacenamiento local.', 'error');
            }
        }

        function handleExternalStateSync() {
            appState = loadState();
            if (currentUser) {
                const refreshedUser = appState.users.find(u => u.id === currentUser.id);
                if (!refreshedUser) {
                    logout();
                    return;
                }
                currentUser = refreshedUser;
                updateSidebarProfile();
                renderGlobalAlerts();
                renderCurrentView();
            }
        }

        if (syncChannel) {
            syncChannel.onmessage = (event) => {
                if (event.data && event.data.type === 'STATE_UPDATED') {
                    handleExternalStateSync();
                }
            };
        }

        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                handleExternalStateSync();
            }
        });

        /* ==========================================================================
           2. UTILIDADES DE INTERFAZ, VALIDACIÓN Y MODALES
           ========================================================================== */
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            const styles = {
                success: 'bg-emerald-600 text-white',
                error: 'bg-red-600 text-white',
                warning: 'bg-amber-500 text-white',
                info: 'bg-slate-900 text-white'
            };
            const icons = {
                success: 'fa-circle-check',
                error: 'fa-circle-exclamation',
                warning: 'fa-triangle-exclamation',
                info: 'fa-circle-info'
            };
            toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-xs font-semibold fade-in ${styles[type] || styles.info}`;
            toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-sm"></i><span class="flex-1">${escapeHtml(message)}</span>`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.25s ease';
                setTimeout(() => toast.remove(), 260);
            }, 3400);
        }

        function openModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('hidden');
            el.classList.add('flex');
        }

        function closeModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('hidden');
            el.classList.remove('flex');
        }

        let confirmCallback = null;
        let confirmRequiresAdminPass = false;

        function openConfirmDialog({ title, message, summaryHtml = '', requireAdminPassword = false, okText = 'Aceptar', onConfirm }) {
            document.getElementById('confirm-title').textContent = title || 'Confirmar Acción';
            document.getElementById('confirm-message').innerHTML = message || '¿Desea confirmar esta operación?';

            const summaryBox = document.getElementById('confirm-summary-box');
            if (summaryHtml) {
                summaryBox.innerHTML = summaryHtml;
                summaryBox.classList.remove('hidden');
            } else {
                summaryBox.innerHTML = '';
                summaryBox.classList.add('hidden');
            }

            const passWrapper = document.getElementById('confirm-password-wrapper');
            const passInput = document.getElementById('confirm-admin-password');
            const passErr = document.getElementById('confirm-password-error');
            passInput.value = '';
            passErr.classList.add('hidden');

            confirmRequiresAdminPass = Boolean(requireAdminPassword);
            if (confirmRequiresAdminPass) {
                passWrapper.classList.remove('hidden');
            } else {
                passWrapper.classList.add('hidden');
            }

            document.getElementById('confirm-ok-btn').textContent = okText;
            confirmCallback = onConfirm;
            openModal('confirm-modal');
        }

        function closeConfirmModal() {
            confirmCallback = null;
            closeModal('confirm-modal');
        }

        document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmModal);
        document.getElementById('confirm-ok-btn').addEventListener('click', () => {
            if (confirmRequiresAdminPass) {
                const entered = document.getElementById('confirm-admin-password').value;
                const adminValid = appState.users.some(u => u.role === 'admin' && u.password === entered);
                if (!adminValid) {
                    document.getElementById('confirm-password-error').classList.remove('hidden');
                    return;
                }
            }
            const cb = confirmCallback;
            closeConfirmModal();
            if (typeof cb === 'function') cb();
        });

        function sanitizeOnlyLetters(input) {
            input.value = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        }

        function sanitizeOnlyNumbers(input) {
            input.value = input.value.replace(/[^0-9]/g, '');
        }

        function updateCharCounter(inputId, counterId) {
            const el = document.getElementById(inputId);
            const counter = document.getElementById(counterId);
            if (el && counter) {
                counter.textContent = `${el.value.length} / ${el.maxLength || 200}`;
            }
        }

        function populateSelect(selectEl, items, selectedValue = '') {
            if (!selectEl) return;
            selectEl.innerHTML = items.map(item => {
                const sel = item === selectedValue ? 'selected' : '';
                return `<option value="${escapeHtml(item)}" ${sel}>${escapeHtml(item)}</option>`;
            }).join('');
        }

        function getTodayStr() {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function getNowTimeStr() {
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${min}`;
        }

        function formatDateDisplay(isoDate) {
            if (!isoDate) return '-';
            const parts = isoDate.split('-');
            if (parts.length !== 3) return isoDate;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        function formatTime12h(time24) {
            if (!time24) return '-';
            const [hStr, mStr] = time24.split(':');
            let h = parseInt(hStr, 10);
            if (isNaN(h)) return time24;
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
        }

        /* ==========================================================================
           3. AUTENTICACIÓN Y GESTIÓN DE SESIÓN
           ========================================================================== */
        function quickFillLogin(username) {
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = '123';
            document.getElementById('login-error').classList.add('hidden');
        }

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const found = appState.users.find(u => u.username.toLowerCase() === username && u.password === password);

            if (!found) {
                document.getElementById('login-error').classList.remove('hidden');
                return;
            }

            document.getElementById('login-error').classList.add('hidden');
            currentUser = found;
            initAuthenticatedApp();
            showToast(`Bienvenido, ${currentUser.name}`);
        });

        function initAuthenticatedApp() {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-shell').classList.remove('hidden');
            updateSidebarProfile();
            activeView = 'dashboard';
            renderNavigation();
            renderGlobalAlerts();
            renderCurrentView();
        }

        function updateSidebarProfile() {
            if (!currentUser) return;
            document.getElementById('sidebar-user-avatar').src = currentUser.avatar || getAvatarUrl(currentUser.name);
            document.getElementById('sidebar-user-name').textContent = currentUser.name;
            document.getElementById('sidebar-user-role').textContent = currentUser.role === 'admin' ? 'Administrador Líder' : 'Técnico TI';
        }

        function logout() {
            currentUser = null;
            document.getElementById('app-shell').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('login-password').value = '';
            showToast('Sesión cerrada correctamente', 'info');
        }

        /* ==========================================================================
           4. NAVEGACIÓN DIFERENCIADA Y ALERTAS GLOBALES
           ========================================================================== */
        function renderNavigation() {
            if (!currentUser) return;
            const isAdmin = currentUser.role === 'admin';

            const mainNavItems = [
                { id: 'dashboard', label: 'Inicio', icon: 'fa-house' },
                { id: 'agenda', label: 'Agenda por Horas', icon: 'fa-calendar-days' }
            ];

            if (isAdmin) {
                mainNavItems.push(
                    { id: 'records', label: 'Registros (BD)', icon: 'fa-database' },
                    { id: 'reports', label: 'Reportes', icon: 'fa-chart-pie' },
                    { id: 'maintenance', label: 'Mantenimiento', icon: 'fa-sliders' },
                    { id: 'sql', label: 'Base de Datos SQL', icon: 'fa-server' }
                );
            }

            const navEl = document.getElementById('sidebar-nav');
            navEl.innerHTML = mainNavItems.map(item => {
                const active = activeView === item.id;
                const cls = active
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-brand';
                return `
                    <button onclick="navigateTo('${item.id}')" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${cls}">
                        <i class="fa-solid ${item.icon}"></i>
                        <span>${item.label}</span>
                    </button>
                `;
            }).join('');

            const specEl = document.getElementById('specialized-nav');
            const meetActive = activeView === 'meet';
            const inkActive = activeView === 'inks';

            let specHtml = `
                <button onclick="navigateTo('meet')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    meetActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white'
                }">
                    <i class="fa-solid fa-video"></i>
                    <span>Panel Google Meet</span>
                </button>
            `;

            if (isAdmin) {
                specHtml += `
                    <button onclick="navigateTo('inks')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                        inkActive
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white'
                    }">
                        <i class="fa-solid fa-fill-drip"></i>
                        <span>Panel de Tintas</span>
                    </button>
                `;
            }

            specEl.innerHTML = specHtml;
        }

        function navigateTo(view) {
            activeView = view;
            renderNavigation();
            renderCurrentView();
        }

        function renderGlobalAlerts() {
            const bar = document.getElementById('global-alerts-bar');
            if (!bar || !currentUser) return;
            const alerts = [];
            const today = getTodayStr();

            const dueMeets = appState.meetLicenses.filter(m => m.status === 'ACTIVO' && m.endDate <= today);
            if (dueMeets.length > 0) {
                alerts.push(`
                    <div class="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3 text-xs text-blue-900">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-bell text-blue-600"></i>
                            <span><strong>Alerta Licencias Meet:</strong> Existen <strong>${dueMeets.length}</strong> licencia(s) activa(s) cuya fecha de fin ya venció o vence hoy y deben ser retiradas.</span>
                        </div>
                        <button onclick="navigateTo('meet')" class="px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold shrink-0">Revisar Meet</button>
                    </div>
                `);
            }

            if (currentUser.role === 'admin') {
                const lowInks = appState.inks.filter(i => Number(i.stock) <= 1);
                if (lowInks.length > 0) {
                    const names = lowInks.map(i => `${i.code} (${i.campus}: ${i.stock})`).join(', ');
                    alerts.push(`
                        <div class="p-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-xs text-amber-950">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
                                <span><strong>Alerta Stock Crítico de Tintas (≤ 1):</strong> ${escapeHtml(names)}</span>
                            </div>
                            <button onclick="navigateTo('inks')" class="px-3 py-1 bg-amber-600 text-white rounded-lg font-semibold shrink-0">Ir a Tintas</button>
                        </div>
                    `);
                }
            }

            if (alerts.length > 0) {
                bar.innerHTML = alerts.join('');
                bar.classList.remove('hidden');
            } else {
                bar.innerHTML = '';
                bar.classList.add('hidden');
            }
        }

        function renderCurrentView() {
            const titleEl = document.getElementById('page-title');
            const subEl = document.getElementById('page-subtitle');

            const titles = {
                dashboard: ['Panel Principal', currentUser.role === 'admin' ? 'Vista general de atenciones, eventos y recursos TI' : `Atenciones y agenda asignadas a ${currentUser.name}`],
                agenda: ['Agenda por Horas', 'Programación horaria de eventos y habilitación de equipos'],
                meet: ['Control de Licencias Google Meet', 'Asignación, descuento automático sobre 100 licencias y alertas de retiro'],
                inks: ['Gestión de Tintas y Tóner por Campus', 'Control de inventario por sede y descuento automático en recargas'],
                records: ['Base de Datos de Registros', 'Historial completo de tickets y requerimientos con edición validada'],
                reports: ['Reportes Estadísticos TI', 'Indicadores por fechas, periodos y rendimiento de técnicos'],
                maintenance: ['Panel de Mantenimiento', 'Configuración en vivo de catálogos, usuarios y plantilla HTML/Imagen'],
                sql: ['Base de Datos SQL y Carpetas', 'Script relacional MySQL y descarga del proyecto organizado en carpetas']
            };

            const [t, s] = titles[activeView] || titles.dashboard;
            titleEl.textContent = t;
            subEl.textContent = s;

            switch (activeView) {
                case 'dashboard': renderDashboardView(); break;
                case 'agenda': renderAgendaView(); break;
                case 'meet': renderMeetView(); break;
                case 'inks': renderInksView(); break;
                case 'records': renderRecordsView(); break;
                case 'reports': renderReportsView(); break;
                case 'maintenance': renderMaintenanceView(); break;
                case 'sql': renderSqlView(); break;
                default: renderDashboardView();
            }
        }

        /* ==========================================================================
           5. CORRELATIVOS AUTOMÁTICOS POR TÉCNICO
           ========================================================================== */
        function getTechInitial(techId) {
            const tech = appState.users.find(u => u.id === techId);
            if (!tech || !tech.name) return 'T';
            const clean = tech.name.trim().replace(/[^a-zA-Z]/g, '');
            return (clean[0] || 'T').toUpperCase();
        }

        function generateNextTicketCode(techId) {
            const initial = getTechInitial(techId);
            const techTickets = appState.tickets.filter(t => t.techId === techId);
            let maxNum = 0;
            techTickets.forEach(t => {
                const match = String(t.code || '').match(/^TK(\d+)-/i);
                if (match) {
                    const n = parseInt(match[1], 10);
                    if (n > maxNum) maxNum = n;
                }
            });
            const nextNum = String(maxNum + 1).padStart(3, '0');
            return `TK${nextNum}-${initial}`;
        }

        function generateNextEventCode(techId) {
            const initial = getTechInitial(techId);
            const techEvents = appState.events.filter(ev => ev.techId === techId);
            let maxNum = 0;
            techEvents.forEach(ev => {
                const match = String(ev.code || '').match(/^RQ(\d+)-/i);
                if (match) {
                    const n = parseInt(match[1], 10);
                    if (n > maxNum) maxNum = n;
                }
            });
            const nextNum = String(maxNum + 1).padStart(3, '0');
            return `RQ${nextNum}-${initial}`;
        }

        /* ==========================================================================
           6. VISTA 1: PANEL PRINCIPAL (DASHBOARD LIMPIO Y AIREADO)
           ========================================================================== */
        function renderDashboardView() {
            const container = document.getElementById('view-container');
            const isAdmin = currentUser.role === 'admin';

            const visibleTickets = isAdmin
                ? appState.tickets
                : appState.tickets.filter(t => t.techId === currentUser.id);
            const visibleEvents = isAdmin
                ? appState.events
                : appState.events.filter(ev => ev.techId === currentUser.id);

            const activeMeetsCount = appState.meetLicenses.filter(m => m.status === 'ACTIVO').length;
            const availableMeets = Math.max(0, appState.meetLicensesTotal - activeMeetsCount);
            const totalInkStock = appState.inks.reduce((acc, i) => acc + Number(i.stock || 0), 0);

            container.innerHTML = `
                <div class="space-y-6 fade-in">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${isAdmin ? '4' : '3'} gap-4">
                        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p class="text-xs font-semibold text-slate-400">Tickets ${isAdmin ? 'Totales' : 'Asignados'}</p>
                                <p class="text-2xl font-extrabold text-slate-900 mt-1">${visibleTickets.length}</p>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center">
                                <i class="fa-solid fa-ticket text-lg"></i>
                            </div>
                        </div>

                        <div class="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                            <div>
                                <p class="text-xs font-semibold text-slate-400">Eventos ${isAdmin ? 'Totales' : 'Asignados'}</p>
                                <p class="text-2xl font-extrabold text-slate-900 mt-1">${visibleEvents.length}</p>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
                                <i class="fa-solid fa-calendar-check text-lg"></i>
                            </div>
                        </div>

                        <div onclick="navigateTo('meet')" class="cursor-pointer bg-blue-50/60 hover:bg-blue-50 p-5 rounded-2xl border border-blue-200/80 flex items-center justify-between transition">
                            <div>
                                <p class="text-xs font-bold text-blue-700">Licencias Google Meet</p>
                                <p class="text-2xl font-extrabold text-blue-950 mt-1">${availableMeets} <span class="text-xs font-semibold text-blue-600">/ ${appState.meetLicensesTotal} disp.</span></p>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                                <i class="fa-solid fa-video text-lg"></i>
                            </div>
                        </div>

                        ${isAdmin ? `
                        <div onclick="navigateTo('inks')" class="cursor-pointer bg-amber-50/60 hover:bg-amber-50 p-5 rounded-2xl border border-amber-200/80 flex items-center justify-between transition">
                            <div>
                                <p class="text-xs font-bold text-amber-800">Stock Total Tintas</p>
                                <p class="text-2xl font-extrabold text-amber-950 mt-1">${totalInkStock} <span class="text-xs font-semibold text-amber-700">unid.</span></p>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
                                <i class="fa-solid fa-fill-drip text-lg"></i>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-900">Tickets de Atención TI</h3>
                                    <p class="text-[11px] text-slate-400">${isAdmin ? 'Todos los tickets registrados' : 'Tickets asignados a tu usuario'}</p>
                                </div>
                                <button onclick="openTicketFormModal()" class="px-3 py-1.5 bg-brand-soft text-brand hover:bg-brand hover:text-white text-xs font-semibold rounded-xl transition">
                                    + Nuevo Ticket
                                </button>
                            </div>
                            <div class="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                                ${visibleTickets.length === 0 ? `
                                    <div class="p-10 text-center text-xs text-slate-400">
                                        <i class="fa-regular fa-folder-open text-2xl mb-2 block text-slate-300"></i>
                                        No hay tickets registrados aún.
                                    </div>
                                ` : visibleTickets.slice().reverse().map(tk => `
                                    <div class="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-brand-soft text-brand">${escapeHtml(tk.code)}</span>
                                                <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(tk.service)}</span>
                                            </div>
                                            <p class="text-xs text-slate-500 mt-1 truncate">
                                                ${escapeHtml(tk.userName)} ${escapeHtml(tk.userLastname)} • ${escapeHtml(tk.campus)} (${escapeHtml(tk.room)})
                                            </p>
                                            <p class="text-[11px] text-slate-400 mt-0.5">
                                                Técnico: <strong>${escapeHtml(tk.techName)}</strong> • Estado: <span class="font-semibold text-slate-700">${escapeHtml(tk.status)}</span>
                                            </p>
                                        </div>
                                        <button onclick='openAutoHtmlPreviewById("ticket", "${tk.id}")' title="Generar Imagen / HTML" class="px-3 py-2 bg-slate-100 hover:bg-brand hover:text-white text-slate-700 text-xs font-semibold rounded-xl transition shrink-0">
                                            <i class="fa-solid fa-image mr-1"></i>HTML/IMG
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 class="text-sm font-bold text-slate-900">Requerimientos de Eventos</h3>
                                    <p class="text-[11px] text-slate-400">${isAdmin ? 'Todos los eventos agendados' : 'Eventos asignados a tu usuario'}</p>
                                </div>
                                <button onclick="openEventFormModal()" class="px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white text-xs font-semibold rounded-xl transition">
                                    + Nuevo Evento
                                </button>
                            </div>
                            <div class="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                                ${visibleEvents.length === 0 ? `
                                    <div class="p-10 text-center text-xs text-slate-400">
                                        <i class="fa-regular fa-calendar text-2xl mb-2 block text-slate-300"></i>
                                        No hay requerimientos de eventos registrados aún.
                                    </div>
                                ` : visibleEvents.slice().reverse().map(ev => `
                                    <div class="p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3">
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-900 text-white">${escapeHtml(ev.code)}</span>
                                                <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(ev.eventName)}</span>
                                            </div>
                                            <p class="text-xs text-slate-500 mt-1 truncate">
                                                ${formatDateDisplay(ev.date)} (${formatTime12h(ev.startTime)} - ${formatTime12h(ev.endTime)}) • ${escapeHtml(ev.campus)}
                                            </p>
                                            <p class="text-[11px] text-slate-400 mt-0.5">
                                                Técnico: <strong>${escapeHtml(ev.techName)}</strong> • Estado: <span class="font-semibold text-slate-700">${escapeHtml(ev.status)}</span>
                                            </p>
                                        </div>
                                        <button onclick='openAutoHtmlPreviewById("event", "${ev.id}")' title="Generar Imagen / HTML" class="px-3 py-2 bg-slate-100 hover:bg-brand hover:text-white text-slate-700 text-xs font-semibold rounded-xl transition shrink-0">
                                            <i class="fa-solid fa-image mr-1"></i>HTML/IMG
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /* ==========================================================================
           7. FORMULARIO Y LÓGICA DE TICKETS DE ATENCIÓN
           ========================================================================== */
        function openTicketFormModal(editId = null) {
            const isEdit = Boolean(editId);
            const record = isEdit ? appState.tickets.find(t => t.id === editId) : null;

            document.getElementById('tk-edit-id').value = record ? record.id : '';
            document.getElementById('ticket-modal-heading').textContent = record
                ? `Editar Ticket ${record.code}`
                : 'Ficha de Atención de Ticket';

            populateSelect(document.getElementById('tk-channel'), appState.catalogs.canales, record?.channel);
            populateSelect(document.getElementById('tk-campus'), appState.catalogs.campus, record?.campus);
            populateSelect(document.getElementById('tk-place'), appState.catalogs.lugares, record?.place);
            populateSelect(document.getElementById('tk-collaborator'), appState.catalogs.colaboradores, record?.collaborator);
            populateSelect(document.getElementById('tk-service'), appState.catalogs.servicios, record?.service);
            populateSelect(document.getElementById('tk-ink-model'), appState.catalogs.modelosTinta, record?.inkModel);
            populateSelect(document.getElementById('tk-priority'), appState.catalogs.prioridades, record?.priority);
            populateSelect(document.getElementById('tk-status'), appState.catalogs.estados, record?.status);

            const techSelect = document.getElementById('tk-tech');
            const assignableUsers = appState.users.filter(u => u.role === 'tech' || u.role === 'admin');
            techSelect.innerHTML = assignableUsers.map(u => {
                const selectedId = record ? record.techId : currentUser.id;
                return `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${escapeHtml(u.name)} (${u.role === 'admin' ? 'Admin' : 'Técnico'})</option>`;
            }).join('');

            if (currentUser.role === 'admin') {
                techSelect.disabled = false;
            } else {
                techSelect.value = currentUser.id;
                techSelect.disabled = true;
            }

            document.getElementById('tk-code').value = record ? record.code : generateNextTicketCode(techSelect.value);

            document.getElementById('tk-room').value = record?.room || '';
            document.getElementById('tk-user-name').value = record?.userName || '';
            document.getElementById('tk-user-lastname').value = record?.userLastname || '';
            document.getElementById('tk-close-date').value = record?.closeDate || getTodayStr();
            document.getElementById('tk-close-time').value = record?.closeTime || getNowTimeStr();
            document.getElementById('tk-obs').value = record?.obs || '';
            updateCharCounter('tk-obs', 'tk-obs-counter');

            document.getElementById('tk-meet-email').value = record?.meetEmail || '';
            document.getElementById('tk-meet-start').value = record?.meetStart || getTodayStr();
            document.getElementById('tk-meet-end').value = record?.meetEnd || getTodayStr();

            onTicketCampusOrServiceChange();
            openModal('ticket-form-modal');
        }

        function onTicketTechChange() {
            const editId = document.getElementById('tk-edit-id').value;
            if (editId) return;
            const techId = document.getElementById('tk-tech').value;
            document.getElementById('tk-code').value = generateNextTicketCode(techId);
        }

        function onTicketCampusOrServiceChange() {
            const service = (document.getElementById('tk-service').value || '').toLowerCase();
            const campus = document.getElementById('tk-campus').value;
            const inkWrapper = document.getElementById('tk-ink-wrapper');
            const meetWrapper = document.getElementById('tk-meet-wrapper');

            const isInk = service.includes('tinta') || service.includes('toner') || service.includes('tóner');
            const isMeet = service.includes('meet');

            if (isInk) {
                inkWrapper.classList.remove('hidden');
                const model = document.getElementById('tk-ink-model').value;
                const inkItem = appState.inks.find(i => i.campus.toLowerCase() === campus.toLowerCase() && i.code.toLowerCase() === model.toLowerCase());
                const hint = document.getElementById('tk-ink-stock-hint');
                if (inkItem) {
                    hint.textContent = `Stock disponible en ${campus}: ${inkItem.stock} unidad(es). Se descontará 1 automáticamente.`;
                    hint.className = Number(inkItem.stock) <= 1 ? 'text-[11px] font-bold text-red-600 mt-1' : 'text-[11px] text-emerald-700 mt-1';
                } else {
                    hint.textContent = `Sin stock registrado para ${model} en ${campus}.`;
                    hint.className = 'text-[11px] text-amber-600 mt-1';
                }
            } else {
                inkWrapper.classList.add('hidden');
            }

            if (isMeet && !document.getElementById('tk-edit-id').value) {
                meetWrapper.classList.remove('hidden');
            } else {
                meetWrapper.classList.add('hidden');
            }
        }

        document.getElementById('tk-ink-model').addEventListener('change', onTicketCampusOrServiceChange);

        document.getElementById('ticket-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = document.getElementById('tk-edit-id').value;
            const techId = document.getElementById('tk-tech').value;
            const techObj = appState.users.find(u => u.id === techId) || currentUser;

            const payload = {
                id: editId || ('tk_' + Date.now()),
                code: editId ? document.getElementById('tk-code').value : generateNextTicketCode(techId),
                techId: techObj.id,
                techName: techObj.name,
                channel: document.getElementById('tk-channel').value,
                campus: document.getElementById('tk-campus').value,
                place: document.getElementById('tk-place').value,
                room: document.getElementById('tk-room').value.trim(),
                collaborator: document.getElementById('tk-collaborator').value,
                userName: document.getElementById('tk-user-name').value.trim(),
                userLastname: document.getElementById('tk-user-lastname').value.trim(),
                service: document.getElementById('tk-service').value,
                inkModel: document.getElementById('tk-ink-model').value,
                priority: document.getElementById('tk-priority').value,
                status: document.getElementById('tk-status').value,
                closeDate: document.getElementById('tk-close-date').value,
                closeTime: document.getElementById('tk-close-time').value,
                obs: document.getElementById('tk-obs').value.trim(),
                createdAt: new Date().toISOString()
            };

            const isInk = payload.service.toLowerCase().includes('tinta') || payload.service.toLowerCase().includes('toner') || payload.service.toLowerCase().includes('tóner');
            const isMeet = payload.service.toLowerCase().includes('meet');

            if (!editId && isInk) {
                const inkItem = appState.inks.find(i => i.campus.toLowerCase() === payload.campus.toLowerCase() && i.code.toLowerCase() === payload.inkModel.toLowerCase());
                if (!inkItem || Number(inkItem.stock) <= 0) {
                    showToast(`No hay stock disponible de ${payload.inkModel} en el campus ${payload.campus}.`, 'error');
                    return;
                }
            }

            if (!editId && isMeet) {
                const meetEmail = document.getElementById('tk-meet-email').value.trim();
                const meetStart = document.getElementById('tk-meet-start').value;
                const meetEnd = document.getElementById('tk-meet-end').value;
                if (!meetEmail || !meetStart || !meetEnd) {
                    showToast('Complete el correo y fechas de inicio/fin para asignar la Licencia Meet.', 'warning');
                    return;
                }
                const activeCount = appState.meetLicenses.filter(m => m.status === 'ACTIVO').length;
                if (activeCount >= appState.meetLicensesTotal) {
                    showToast('No quedan licencias Google Meet disponibles (100 en uso).', 'error');
                    return;
                }
                payload.meetEmail = meetEmail;
                payload.meetStart = meetStart;
                payload.meetEnd = meetEnd;
            }

            const summaryHtml = `
                <div><strong>N° Ticket:</strong> ${escapeHtml(payload.code)} (${escapeHtml(payload.techName)})</div>
                <div><strong>Campus / Ambiente:</strong> ${escapeHtml(payload.campus)} - ${escapeHtml(payload.place)} (${escapeHtml(payload.room)})</div>
                <div><strong>Usuario:</strong> ${escapeHtml(payload.userName)} ${escapeHtml(payload.userLastname)}</div>
                <div><strong>Servicio:</strong> ${escapeHtml(payload.service)} ${isInk ? `(${escapeHtml(payload.inkModel)})` : ''}</div>
                <div><strong>Estado / Prioridad:</strong> ${escapeHtml(payload.status)} / ${escapeHtml(payload.priority)}</div>
                <div><strong>Cierre:</strong> ${formatDateDisplay(payload.closeDate)} ${payload.closeTime}</div>
            `;

            openConfirmDialog({
                title: editId ? 'Confirmar Edición de Ticket' : 'Validar y Registrar Ticket',
                message: 'Verifique los datos ingresados antes de confirmar el envío:',
                summaryHtml,
                requireAdminPassword: Boolean(editId),
                okText: 'Aceptar y Guardar',
                onConfirm: () => {
                    if (editId) {
                        const idx = appState.tickets.findIndex(t => t.id === editId);
                        if (idx !== -1) appState.tickets[idx] = { ...appState.tickets[idx], ...payload };
                    } else {
                        appState.tickets.push(payload);

                        if (isInk) {
                            const inkItem = appState.inks.find(i => i.campus.toLowerCase() === payload.campus.toLowerCase() && i.code.toLowerCase() === payload.inkModel.toLowerCase());
                            if (inkItem && Number(inkItem.stock) > 0) {
                                inkItem.stock = Number(inkItem.stock) - 1;
                                if (inkItem.stock === 1) {
                                    showToast(`ALERTA: Queda solo 1 unidad de ${inkItem.code} en ${inkItem.campus}.`, 'warning');
                                }
                            }
                        }

                        if (isMeet) {
                            appState.meetLicenses.push({
                                id: 'mt_' + Date.now(),
                                ticketCode: payload.code,
                                techId: payload.techId,
                                techName: payload.techName,
                                userNames: payload.userName,
                                userLastnames: payload.userLastname,
                                email: payload.meetEmail,
                                startDate: payload.meetStart,
                                endDate: payload.meetEnd,
                                status: 'ACTIVO',
                                registeredAt: `${getTodayStr()} ${getNowTimeStr()}`
                            });
                        }
                    }

                    saveState();
                    closeModal('ticket-form-modal');
                    renderGlobalAlerts();
                    renderCurrentView();
                    showToast(editId ? 'Ticket actualizado correctamente.' : `Ticket ${payload.code} registrado exitosamente.`);

                    openAutoHtmlPreview('ticket', payload);
                }
            });
        });

        /* ==========================================================================
           8. FORMULARIO Y LÓGICA DE REQUERIMIENTOS PARA EVENTOS
           ========================================================================== */
        function openEventFormModal(editId = null) {
            const isEdit = Boolean(editId);
            const record = isEdit ? appState.events.find(ev => ev.id === editId) : null;

            document.getElementById('ev-edit-id').value = record ? record.id : '';
            document.getElementById('event-modal-heading').textContent = record
                ? `Editar Requerimiento ${record.code}`
                : 'Ficha de Requerimiento para Eventos';

            populateSelect(document.getElementById('ev-channel'), appState.catalogs.canales, record?.channel);
            populateSelect(document.getElementById('ev-type'), appState.catalogs.tiposEvento, record?.eventType);
            populateSelect(document.getElementById('ev-campus'), appState.catalogs.campus, record?.campus);
            populateSelect(document.getElementById('ev-school'), appState.catalogs.escuelas, record?.school);
            populateSelect(document.getElementById('ev-priority'), appState.catalogs.prioridades, record?.priority);
            populateSelect(document.getElementById('ev-status'), appState.catalogs.estados, record?.status);

            const techSelect = document.getElementById('ev-tech');
            const assignableUsers = appState.users.filter(u => u.role === 'tech' || u.role === 'admin');
            techSelect.innerHTML = assignableUsers.map(u => {
                const selectedId = record ? record.techId : currentUser.id;
                return `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${escapeHtml(u.name)} (${u.role === 'admin' ? 'Admin' : 'Técnico'})</option>`;
            }).join('');

            if (currentUser.role === 'admin') {
                techSelect.disabled = false;
            } else {
                techSelect.value = currentUser.id;
                techSelect.disabled = true;
            }

            document.getElementById('ev-code').value = record ? record.code : generateNextEventCode(techSelect.value);
            document.getElementById('ev-name').value = record?.eventName || '';
            updateCharCounter('ev-name', 'ev-name-counter');

            document.getElementById('ev-date').value = record?.date || getTodayStr();
            document.getElementById('ev-start-time').value = record?.startTime || '09:00';
            document.getElementById('ev-end-time').value = record?.endTime || '11:00';
            document.getElementById('ev-responsible').value = record?.responsible || '';
            document.getElementById('ev-phone').value = record?.phone || '';
            document.getElementById('ev-obs').value = record?.obs || '';
            updateCharCounter('ev-obs', 'ev-obs-counter');

            const selectedEquips = record?.equipments || [];
            const equipContainer = document.getElementById('ev-equipment-list');
            equipContainer.innerHTML = appState.catalogs.equipos.map(eq => {
                const checked = selectedEquips.includes(eq) ? 'checked' : '';
                return `
                    <label class="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-brand cursor-pointer text-xs font-semibold text-slate-700">
                        <input type="checkbox" name="ev-equip-cb" value="${escapeHtml(eq)}" ${checked} class="accent-[#910048] w-4 h-4 rounded">
                        <span>${escapeHtml(eq)}</span>
                    </label>
                `;
            }).join('');

            onEventTypeChange();
            openModal('event-form-modal');
        }

        function onEventTechChange() {
            const editId = document.getElementById('ev-edit-id').value;
            if (editId) return;
            const techId = document.getElementById('ev-tech').value;
            document.getElementById('ev-code').value = generateNextEventCode(techId);
        }

        function onEventTypeChange() {
            const val = (document.getElementById('ev-type').value || '').toLowerCase();
            const schoolWrapper = document.getElementById('ev-school-wrapper');
            if (val.includes('sustentaci')) {
                schoolWrapper.classList.remove('hidden');
            } else {
                schoolWrapper.classList.add('hidden');
            }
        }

        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = document.getElementById('ev-edit-id').value;
            const techId = document.getElementById('ev-tech').value;
            const techObj = appState.users.find(u => u.id === techId) || currentUser;

            const checkedEquips = Array.from(document.querySelectorAll('input[name="ev-equip-cb"]:checked')).map(cb => cb.value);
            if (checkedEquips.length === 0) {
                showToast('Seleccione al menos un equipo solicitado.', 'warning');
                return;
            }

            const eventType = document.getElementById('ev-type').value;
            const isSustentacion = eventType.toLowerCase().includes('sustentaci');

            const payload = {
                id: editId || ('ev_' + Date.now()),
                code: editId ? document.getElementById('ev-code').value : generateNextEventCode(techId),
                techId: techObj.id,
                techName: techObj.name,
                channel: document.getElementById('ev-channel').value,
                eventName: document.getElementById('ev-name').value.trim(),
                eventType,
                campus: document.getElementById('ev-campus').value,
                school: isSustentacion ? document.getElementById('ev-school').value : '',
                date: document.getElementById('ev-date').value,
                startTime: document.getElementById('ev-start-time').value,
                endTime: document.getElementById('ev-end-time').value,
                responsible: document.getElementById('ev-responsible').value.trim(),
                phone: document.getElementById('ev-phone').value.trim(),
                equipments: checkedEquips,
                priority: document.getElementById('ev-priority').value,
                status: document.getElementById('ev-status').value,
                obs: document.getElementById('ev-obs').value.trim(),
                createdAt: new Date().toISOString()
            };

            const summaryHtml = `
                <div><strong>N° Requerimiento:</strong> ${escapeHtml(payload.code)} (${escapeHtml(payload.techName)})</div>
                <div><strong>Evento:</strong> ${escapeHtml(payload.eventName)} (${escapeHtml(payload.eventType)})</div>
                ${payload.school ? `<div><strong>Escuela Profesional:</strong> ${escapeHtml(payload.school)}</div>` : ''}
                <div><strong>Campus / Fecha:</strong> ${escapeHtml(payload.campus)} • ${formatDateDisplay(payload.date)} (${payload.startTime} - ${payload.endTime})</div>
                <div><strong>Responsable / Cel:</strong> ${escapeHtml(payload.responsible)} (${escapeHtml(payload.phone)})</div>
                <div><strong>Equipos:</strong> ${escapeHtml(payload.equipments.join(', '))}</div>
            `;

            openConfirmDialog({
                title: editId ? 'Confirmar Cambios en Requerimiento' : 'Validar y Guardar Requerimiento',
                message: 'Confirme los datos del requerimiento para evento:',
                summaryHtml,
                requireAdminPassword: Boolean(editId && currentUser.role === 'admin'),
                okText: 'Aceptar y Guardar',
                onConfirm: () => {
                    if (editId) {
                        const idx = appState.events.findIndex(ev => ev.id === editId);
                        if (idx !== -1) appState.events[idx] = { ...appState.events[idx], ...payload };
                    } else {
                        appState.events.push(payload);
                    }

                    saveState();
                    closeModal('event-form-modal');
                    renderCurrentView();
                    showToast(editId ? 'Requerimiento actualizado.' : `Requerimiento ${payload.code} registrado.`);

                    openAutoHtmlPreview('event', payload);
                }
            });
        });

        /* ==========================================================================
           9. VENTANA DE IMAGEN AUTOMÁTICO EN HTML (ADAPTADA A TICKET, EVENTO O MEET)
           ========================================================================== */
        function openAutoHtmlPreviewById(type, id) {
            let record = null;
            if (type === 'ticket') record = appState.tickets.find(t => t.id === id);
            if (type === 'event') record = appState.events.find(e => e.id === id);
            if (type === 'meet') record = appState.meetLicenses.find(m => m.id === id);
            if (!record) {
                showToast('Registro no encontrado.', 'error');
                return;
            }
            openAutoHtmlPreview(type, record);
        }

        function openAutoHtmlPreview(type, record) {
            const tpl = appState.htmlTemplate;
            const primary = tpl.primaryColor || '#910048';
            const badge = document.getElementById('preview-type-badge');

            let typeLabel = 'Ticket de Atención';
            let introText = tpl.ticketIntro;
            let noteText = tpl.ticketNote;
            let detailRowsHtml = '';

            if (type === 'ticket') {
                typeLabel = 'Ticket de Atención';
                introText = tpl.ticketIntro;
                noteText = tpl.ticketNote;
                lastGeneratedCaptureName = `ticket_${(record.userName || 'atencion').replace(/\s+/g, '_')}`;
                detailRowsHtml = `
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>SERVICIO:</strong> ${escapeHtml(record.service)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Usuario:</strong> ${escapeHtml(record.userName)} ${escapeHtml(record.userLastname)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Campus y Ambiente:</strong> ${escapeHtml(record.campus)} - ${escapeHtml(record.place)} (${escapeHtml(record.room)})</p>
                    ${record.service && record.service.toLowerCase().includes('tinta') ? `<p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Insumo Utilizado:</strong> ${escapeHtml(record.inkModel)}</p>` : ''}
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Fecha:</strong> ${formatDateDisplay(record.closeDate)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Hora:</strong> ${formatTime12h(record.closeTime)}</p>
                    <p style="margin:0;font-size:13px;color:#1e293b;"><strong>Estado:</strong> ${escapeHtml(record.status)} (Prioridad: ${escapeHtml(record.priority)})</p>
                    ${record.obs ? `<p style="margin:8px 0 0 0;font-size:12px;color:#475569;"><strong>Observaciones:</strong> ${escapeHtml(record.obs)}</p>` : ''}
                `;
            } else if (type === 'event') {
                typeLabel = 'Requerimiento de Evento';
                introText = tpl.eventIntro;
                noteText = tpl.eventNote;
                lastGeneratedCaptureName = `evento_${(record.eventName || 'requerimiento').replace(/\s+/g, '_')}`;
                detailRowsHtml = `
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>EVENTO:</strong> ${escapeHtml(record.eventName)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Tipo de Evento:</strong> ${escapeHtml(record.eventType)}${record.school ? ` (${escapeHtml(record.school)})` : ''}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Campus:</strong> ${escapeHtml(record.campus)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Fecha:</strong> ${formatDateDisplay(record.date)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Hora:</strong> ${formatTime12h(record.startTime)} a ${formatTime12h(record.endTime)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Responsable:</strong> ${escapeHtml(record.responsible)} (Cel: ${escapeHtml(record.phone)})</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Equipos Habilitados:</strong> ${escapeHtml((record.equipments || []).join(', '))}</p>
                    <p style="margin:0;font-size:13px;color:#1e293b;"><strong>Estado:</strong> ${escapeHtml(record.status)}</p>
                    ${record.obs ? `<p style="margin:8px 0 0 0;font-size:12px;color:#475569;"><strong>Observaciones:</strong> ${escapeHtml(record.obs)}</p>` : ''}
                `;
            } else if (type === 'meet') {
                typeLabel = 'Licencia Google Meet';
                introText = tpl.meetIntro;
                noteText = tpl.meetNote;
                lastGeneratedCaptureName = `licencia_meet_${(record.userNames || 'usuario').replace(/\s+/g, '_')}`;
                detailRowsHtml = `
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>SERVICIO:</strong> Asignación de Licencia Google Meet Institucional</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Usuario Beneficiario:</strong> ${escapeHtml(record.userNames)} ${escapeHtml(record.userLastnames)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Correo Asignado:</strong> ${escapeHtml(record.email)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Fecha de Inicio:</strong> ${formatDateDisplay(record.startDate)}</p>
                    <p style="margin:0 0 8px 0;font-size:13px;color:#1e293b;"><strong>Fecha de Finalización:</strong> ${formatDateDisplay(record.endDate)}</p>
                    <p style="margin:0;font-size:13px;color:#1e293b;"><strong>Estado de Licencia:</strong> ${escapeHtml(record.status)}</p>
                `;
            }

            badge.textContent = typeLabel;

            const cardHtml = [
                '<div style="font-family:\'Plus Jakarta Sans\',Arial,sans-serif;max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">',
                `    <div style="background:linear-gradient(90deg, ${escapeHtml(primary)} 0%, #141829 100%);padding:28px 24px;text-align:center;color:#ffffff;">`,
                '        <div style="width:14px;height:14px;border-radius:9999px;background:rgba(255,255,255,0.22);margin:0 auto 12px auto;"></div>',
                `        <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(tpl.headerTitle)}</h2>`,
                `        <p style="margin:6px 0 0 0;font-size:12px;color:#f8fafc;opacity:0.9;">${escapeHtml(tpl.headerSubtitle)}</p>`,
                '    </div>',
                '    <div style="padding:24px;background:#ffffff;">',
                `        <p style="margin:0 0 18px 0;font-size:13px;line-height:1.55;color:#475569;">${escapeHtml(introText)}</p>`,
                `        <div style="background:#f8fafc;border-left:4px solid ${escapeHtml(primary)};border-radius:8px;padding:16px 18px;margin-bottom:18px;">${detailRowsHtml}</div>`,
                '        <div style="background:#fdf2f7;border:1px solid #fce7f3;border-radius:10px;padding:14px 16px;margin-bottom:18px;">',
                `            <p style="margin:0;font-size:12px;line-height:1.5;color:${escapeHtml(primary)};">${escapeHtml(noteText)}</p>`,
                '        </div>',
                `        <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtml(tpl.footerClosing)}</p>`,
                '    </div>',
                '    <div style="background:#111625;padding:20px 24px;text-align:center;color:#ffffff;">',
                `        <p style="margin:0;font-size:13px;font-weight:700;">${escapeHtml(tpl.footerOrg)}</p>`,
                `        <p style="margin:4px 0 10px 0;font-size:11px;color:#cbd5e1;">${escapeHtml(tpl.footerUni)}</p>`,
                `        <p style="margin:0 0 4px 0;font-size:11px;color:#e2e8f0;">📍 ${escapeHtml(tpl.footerAddress)}</p>`,
                `        <p style="margin:0;font-size:11px;color:#60a5fa;font-weight:600;">📱 Celular: ${escapeHtml(tpl.footerPhone)}</p>`,
                '    </div>',
                '</div>'
            ].join('\n');

            lastGeneratedHtml = cardHtml;
            document.getElementById('capture-card-area').innerHTML = cardHtml;
            document.getElementById('generated-html-code').value = cardHtml;
            document.getElementById('html-code-drawer').classList.add('hidden');
            document.getElementById('toggle-html-label').textContent = 'Ver Código HTML';

            openModal('email-preview-modal');
        }

        function toggleHtmlCodeDrawer() {
            const drawer = document.getElementById('html-code-drawer');
            const label = document.getElementById('toggle-html-label');
            const isHidden = drawer.classList.contains('hidden');
            if (isHidden) {
                drawer.classList.remove('hidden');
                label.textContent = 'Ocultar HTML';
            } else {
                drawer.classList.add('hidden');
                label.textContent = 'Ver Código HTML';
            }
        }

        function copyGeneratedHtml() {
            const textarea = document.getElementById('generated-html-code');
            const drawer = document.getElementById('html-code-drawer');
            const wasHidden = drawer.classList.contains('hidden');
            if (wasHidden) drawer.classList.remove('hidden');
            textarea.select();
            textarea.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                showToast('Código HTML copiado al portapapeles.');
            } catch (err) {
                showToast('No se pudo copiar el código HTML.', 'error');
            }
            if (wasHidden) drawer.classList.add('hidden');
        }

        async function copyGeneratedImageToClipboard() {
            const target = document.getElementById('capture-card-area');
            try {
                const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                canvas.toBlob(async (blob) => {
                    if (!blob) return;
                    if (navigator.clipboard && window.ClipboardItem) {
                        try {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            showToast('Imagen PNG copiada al portapapeles. Puede pegarla en su correo (Ctrl+V).');
                        } catch (clipErr) {
                            downloadGeneratedImage();
                        }
                    } else {
                        downloadGeneratedImage();
                    }
                }, 'image/png');
            } catch (err) {
                showToast('Error al generar la imagen PNG.', 'error');
            }
        }

        async function downloadGeneratedImage() {
            const target = document.getElementById('capture-card-area');
            try {
                const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                const link = document.createElement('a');
                link.download = `${lastGeneratedCaptureName}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('Imagen PNG descargada.');
            } catch (err) {
                showToast('Error al descargar la imagen.', 'error');
            }
        }

        /* ==========================================================================
           10. PANEL DE AGENDA POR HORAS
           ========================================================================== */
        let agendaFilterDate = getTodayStr();
        let agendaFilterTech = 'ALL';

        function renderAgendaView() {
            const container = document.getElementById('view-container');
            const isAdmin = currentUser.role === 'admin';

            const techFilterHtml = isAdmin ? `
                <div>
                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Filtrar por Técnico</label>
                    <select onchange="agendaFilterTech = this.value; renderAgendaView();" class="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white">
                        <option value="ALL" ${agendaFilterTech === 'ALL' ? 'selected' : ''}>Todos los técnicos</option>
                        ${appState.users.map(u => `<option value="${u.id}" ${agendaFilterTech === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
                    </select>
                </div>
            ` : '';

            const filteredEvents = appState.events.filter(ev => {
                if (ev.date !== agendaFilterDate) return false;
                if (!isAdmin) return ev.techId === currentUser.id;
                if (agendaFilterTech !== 'ALL') return ev.techId === agendaFilterTech;
                return true;
            }).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            const hours = Array.from({ length: 16 }, (_, idx) => String(idx + 7).padStart(2, '0') + ':00');

            container.innerHTML = `
                <div class="space-y-5 fade-in">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-end justify-between gap-4">
                        <div class="flex flex-wrap items-end gap-3">
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Fecha de Agenda</label>
                                <input type="date" value="${agendaFilterDate}" onchange="agendaFilterDate = this.value; renderAgendaView();" class="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white">
                            </div>
                            ${techFilterHtml}
                        </div>
                        <button onclick="openEventFormModal()" class="px-4 py-2 bg-brand hover:bg-brand-light text-white text-xs font-semibold rounded-xl transition">
                            <i class="fa-solid fa-plus mr-1"></i>Agendar Evento
                        </button>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                        ${hours.map(hour => {
                            const hourPrefix = hour.slice(0, 2);
                            const slotEvents = filteredEvents.filter(ev => (ev.startTime || '').startsWith(hourPrefix));
                            return `
                                <div class="flex flex-col sm:flex-row">
                                    <div class="sm:w-28 px-4 py-3 bg-slate-50/70 text-xs font-bold text-slate-500 border-b sm:border-b-0 sm:border-r border-slate-100 shrink-0">
                                        ${hour}
                                    </div>
                                    <div class="flex-1 p-3 min-h-[54px] flex flex-col gap-2">
                                        ${slotEvents.length === 0 ? `<span class="text-[11px] text-slate-300">Disponible</span>` : slotEvents.map(ev => `
                                            <div class="p-3 rounded-xl bg-brand-soft/60 border border-brand-border flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="px-2 py-0.5 rounded bg-brand text-white text-[10px] font-bold">${escapeHtml(ev.code)}</span>
                                                        <span class="text-xs font-extrabold text-slate-900">${escapeHtml(ev.eventName)}</span>
                                                        <span class="text-[11px] font-semibold text-brand">(${escapeHtml(ev.startTime)} - ${escapeHtml(ev.endTime)})</span>
                                                    </div>
                                                    <p class="text-[11px] text-slate-600 mt-1">
                                                        Campus: <strong>${escapeHtml(ev.campus)}</strong> • Responsable: ${escapeHtml(ev.responsible)} (${escapeHtml(ev.phone)}) • Técnico: <strong>${escapeHtml(ev.techName)}</strong>
                                                    </p>
                                                    <p class="text-[11px] text-slate-500 mt-0.5">Equipos: ${escapeHtml((ev.equipments || []).join(', '))}</p>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <button onclick="openEventFormModal('${ev.id}')" class="px-3 py-1.5 bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition">
                                                        <i class="fa-solid fa-pen-to-square mr-1"></i>Editar
                                                    </button>
                                                    <button onclick="openAutoHtmlPreviewById('event', '${ev.id}')" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold transition">
                                                        HTML/IMG
                                                    </button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        /* ==========================================================================
           11. PANEL DE CONTROL DE LICENCIAS GOOGLE MEET (APARTADO DIFERENCIADO)
           ========================================================================== */
        let meetFilterStatus = 'ALL';
        let meetFilterFrom = '';
        let meetFilterTo = '';

        function renderMeetView() {
            const container = document.getElementById('view-container');
            const isAdmin = currentUser.role === 'admin';
            const today = getTodayStr();

            const activeCount = appState.meetLicenses.filter(m => m.status === 'ACTIVO').length;
            const retiredCount = appState.meetLicenses.filter(m => m.status === 'RETIRADO').length;
            const dueCount = appState.meetLicenses.filter(m => m.status === 'ACTIVO' && m.endDate <= today).length;
            const availableCount = Math.max(0, appState.meetLicensesTotal - activeCount);
            const usagePercent = Math.min(100, Math.round((activeCount / appState.meetLicensesTotal) * 100));

            const assignableUsers = appState.users.filter(u => u.role === 'tech' || u.role === 'admin');

            const filteredList = appState.meetLicenses.filter(m => {
                if (meetFilterStatus === 'VENCIDO') {
                    if (!(m.status === 'ACTIVO' && m.endDate <= today)) return false;
                } else if (meetFilterStatus !== 'ALL') {
                    if (m.status !== meetFilterStatus) return false;
                }
                if (meetFilterFrom && m.startDate < meetFilterFrom) return false;
                if (meetFilterTo && m.endDate > meetFilterTo) return false;
                return true;
            });

            container.innerHTML = `
                <div class="space-y-6 fade-in">
                    <div class="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-sm">
                        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span class="px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider">Módulo Especializado Google Workspace</span>
                                <h3 class="text-xl font-extrabold mt-2">Pool de 100 Licencias Google Meet</h3>
                                <p class="text-xs text-blue-200 mt-1">Descuento automático al asignar, generación automática de ticket y alertas de vencimiento</p>
                            </div>
                            <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-4 min-w-[230px]">
                                <div class="flex justify-between text-xs font-bold mb-1.5">
                                    <span>Disponibles: ${availableCount} / ${appState.meetLicensesTotal}</span>
                                    <span>${usagePercent}% uso</span>
                                </div>
                                <div class="w-full h-2.5 bg-blue-950 rounded-full overflow-hidden">
                                    <div class="h-full bg-emerald-400 rounded-full transition-all" style="width:${usagePercent}%"></div>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                            <div class="bg-white/10 rounded-2xl p-3">
                                <p class="text-[11px] text-blue-200">Total Licencias</p>
                                <p class="text-xl font-extrabold">${appState.meetLicensesTotal}</p>
                            </div>
                            <div class="bg-white/10 rounded-2xl p-3">
                                <p class="text-[11px] text-emerald-200">Activas (En Uso)</p>
                                <p class="text-xl font-extrabold text-emerald-300">${activeCount}</p>
                            </div>
                            <div class="bg-white/10 rounded-2xl p-3">
                                <p class="text-[11px] text-amber-200">Por Retirar / Vencidas</p>
                                <p class="text-xl font-extrabold text-amber-300">${dueCount}</p>
                            </div>
                            <div class="bg-white/10 rounded-2xl p-3">
                                <p class="text-[11px] text-slate-200">Retiradas (Histórico)</p>
                                <p class="text-xl font-extrabold">${retiredCount}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-blue-200/80">
                        <h4 class="text-sm font-bold text-blue-950 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-plus-circle text-blue-600"></i>
                            <span>Asignar Nueva Licencia Google Meet (Genera Ticket Automático)</span>
                        </h4>
                        <form id="meet-assign-form" onsubmit="submitMeetAssignment(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Nombres del Usuario *</label>
                                <input type="text" id="mt-names" required oninput="sanitizeOnlyLetters(this)" placeholder="Nombres (solo texto)" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Apellidos del Usuario *</label>
                                <input type="text" id="mt-lastnames" required oninput="sanitizeOnlyLetters(this)" placeholder="Apellidos (solo texto)" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Correo Institucional Asignado *</label>
                                <input type="email" id="mt-email" required placeholder="usuario@uroosevelt.edu.pe" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Fecha de Inicio *</label>
                                <input type="date" id="mt-start" required value="${today}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Fecha de Fin *</label>
                                <input type="date" id="mt-end" required value="${today}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Técnico que Asigna *</label>
                                <select id="mt-tech" ${isAdmin ? '' : 'disabled'} class="w-full px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white disabled:bg-slate-100">
                                    ${assignableUsers.map(u => `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="sm:col-span-2 lg:col-span-3 flex justify-end">
                                <button type="submit" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2">
                                    <i class="fa-solid fa-check"></i>
                                    <span>Asignar Licencia y Generar Ticket</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                        <div class="p-4 border-b border-slate-100 flex flex-wrap items-end justify-between gap-3">
                            <div class="flex flex-wrap items-end gap-3">
                                <div>
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Estado</label>
                                    <select onchange="meetFilterStatus = this.value; renderMeetView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white">
                                        <option value="ALL" ${meetFilterStatus === 'ALL' ? 'selected' : ''}>Todos</option>
                                        <option value="ACTIVO" ${meetFilterStatus === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                                        <option value="RETIRADO" ${meetFilterStatus === 'RETIRADO' ? 'selected' : ''}>RETIRADO</option>
                                        <option value="VENCIDO" ${meetFilterStatus === 'VENCIDO' ? 'selected' : ''}>Alertas por Retirar</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Desde</label>
                                    <input type="date" value="${meetFilterFrom}" onchange="meetFilterFrom = this.value; renderMeetView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-[11px] font-semibold text-slate-500 mb-1">Hasta</label>
                                    <input type="date" value="${meetFilterTo}" onchange="meetFilterTo = this.value; renderMeetView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                                </div>
                            </div>
                            <button onclick="exportMeetCsv()" class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition">
                                <i class="fa-solid fa-file-csv mr-1.5"></i>Descargar Excel/CSV
                            </button>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                        <th class="p-3">Ticket Auto</th>
                                        <th class="p-3">Usuario</th>
                                        <th class="p-3">Correo Asignado</th>
                                        <th class="p-3">Inicio / Fin</th>
                                        <th class="p-3">Técnico / Registro</th>
                                        <th class="p-3">Estado</th>
                                        <th class="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${filteredList.length === 0 ? `
                                        <tr><td colspan="7" class="p-8 text-center text-slate-400">No hay registros de licencias Meet con los filtros actuales.</td></tr>
                                    ` : filteredList.slice().reverse().map(m => {
                                        const isDue = m.status === 'ACTIVO' && m.endDate <= today;
                                        return `
                                            <tr class="${isDue ? 'bg-amber-50/70' : 'hover:bg-slate-50'}">
                                                <td class="p-3 font-extrabold text-blue-700">${escapeHtml(m.ticketCode)}</td>
                                                <td class="p-3 font-semibold text-slate-800">${escapeHtml(m.userNames)} ${escapeHtml(m.userLastnames)}</td>
                                                <td class="p-3 text-slate-600">${escapeHtml(m.email)}</td>
                                                <td class="p-3">
                                                    <div>${formatDateDisplay(m.startDate)} → ${formatDateDisplay(m.endDate)}</div>
                                                    ${isDue ? `<span class="inline-block mt-0.5 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">¡Retirar licencia!</span>` : ''}
                                                </td>
                                                <td class="p-3 text-slate-500">
                                                    <div>${escapeHtml(m.techName)}</div>
                                                    <div class="text-[10px] text-slate-400">${escapeHtml(m.registeredAt)}</div>
                                                </td>
                                                <td class="p-3">
                                                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${m.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                                                        ${escapeHtml(m.status)}
                                                    </span>
                                                </td>
                                                <td class="p-3 text-right space-x-1 whitespace-nowrap">
                                                    <button onclick="openAutoHtmlPreviewById('meet', '${m.id}')" class="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-semibold transition">
                                                        HTML/IMG
                                                    </button>
                                                    <button onclick="toggleMeetLicenseStatus('${m.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 rounded-lg font-semibold transition">
                                                        ${m.status === 'ACTIVO' ? 'Retirar' : 'Activar'}
                                                    </button>
                                                    <button onclick="deleteMeetLicense('${m.id}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg font-semibold transition">
                                                        <i class="fa-solid fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        function submitMeetAssignment(e) {
            e.preventDefault();
            const activeCount = appState.meetLicenses.filter(m => m.status === 'ACTIVO').length;
            if (activeCount >= appState.meetLicensesTotal) {
                showToast('No hay licencias disponibles (100 en uso activo).', 'error');
                return;
            }

            const techId = document.getElementById('mt-tech').value;
            const techObj = appState.users.find(u => u.id === techId) || currentUser;
            const userNames = document.getElementById('mt-names').value.trim();
            const userLastnames = document.getElementById('mt-lastnames').value.trim();
            const email = document.getElementById('mt-email').value.trim();
            const startDate = document.getElementById('mt-start').value;
            const endDate = document.getElementById('mt-end').value;

            const autoTicketCode = generateNextTicketCode(techObj.id);
            const nowTime = getNowTimeStr();
            const today = getTodayStr();

            const meetRecord = {
                id: 'mt_' + Date.now(),
                ticketCode: autoTicketCode,
                techId: techObj.id,
                techName: techObj.name,
                userNames,
                userLastnames,
                email,
                startDate,
                endDate,
                status: 'ACTIVO',
                registeredAt: `${today} ${nowTime}`
            };

            const autoTicket = {
                id: 'tk_' + (Date.now() + 1),
                code: autoTicketCode,
                techId: techObj.id,
                techName: techObj.name,
                channel: appState.catalogs.canales[0] || 'correo',
                campus: appState.catalogs.campus[0] || 'Lima',
                place: appState.catalogs.lugares[1] || 'Oficina',
                room: 'Asignación Licencia Meet',
                collaborator: appState.catalogs.colaboradores[0] || 'Docente',
                userName: userNames,
                userLastname: userLastnames,
                service: 'Licencia Meet',
                inkModel: '',
                priority: appState.catalogs.prioridades[0] || 'MASO',
                status: appState.catalogs.estados[2] || 'RESUELTO',
                closeDate: today,
                closeTime: nowTime,
                obs: `Licencia Meet asignada a ${email} (${startDate} al ${endDate})`,
                createdAt: new Date().toISOString()
            };

            appState.meetLicenses.push(meetRecord);
            appState.tickets.push(autoTicket);
            saveState();
            renderGlobalAlerts();
            renderMeetView();
            showToast(`Licencia asignada y Ticket ${autoTicketCode} generado automáticamente.`);
            openAutoHtmlPreview('meet', meetRecord);
        }

        function toggleMeetLicenseStatus(id) {
            const item = appState.meetLicenses.find(m => m.id === id);
            if (!item) return;
            const nextStatus = item.status === 'ACTIVO' ? 'RETIRADO' : 'ACTIVO';
            openConfirmDialog({
                title: 'Cambiar Estado de Licencia Meet',
                message: `¿Desea cambiar el estado de la licencia de <strong>${escapeHtml(item.email)}</strong> a <strong>${nextStatus}</strong>?`,
                okText: 'Confirmar Cambio',
                onConfirm: () => {
                    item.status = nextStatus;
                    saveState();
                    renderGlobalAlerts();
                    renderMeetView();
                    showToast(`Estado actualizado a ${nextStatus}.`);
                }
            });
        }

        function deleteMeetLicense(id) {
            const item = appState.meetLicenses.find(m => m.id === id);
            if (!item) return;
            openConfirmDialog({
                title: 'Eliminar Registro de Licencia Meet',
                message: `¿Está seguro de eliminar el registro de <strong>${escapeHtml(item.email)}</strong>?`,
                okText: 'Eliminar',
                onConfirm: () => {
                    appState.meetLicenses = appState.meetLicenses.filter(m => m.id !== id);
                    saveState();
                    renderGlobalAlerts();
                    renderMeetView();
                    showToast('Registro eliminado.');
                }
            });
        }

        function exportMeetCsv() {
            const headers = ['Ticket', 'Nombres', 'Apellidos', 'Correo', 'Fecha Inicio', 'Fecha Fin', 'Estado', 'Tecnico', 'Fecha Registro'];
            const rows = appState.meetLicenses.map(m => [
                m.ticketCode, m.userNames, m.userLastnames, m.email, m.startDate, m.endDate, m.status, m.techName, m.registeredAt
            ]);
            downloadCsvFile('licencias_meet_upfr.csv', headers, rows);
        }

        /* ==========================================================================
           12. PANEL DE GESTIÓN DE TINTAS POR CAMPUS (APARTADO DIFERENCIADO ADMIN)
           ========================================================================== */
        function renderInksView() {
            if (currentUser.role !== 'admin') return;
            const container = document.getElementById('view-container');

            container.innerHTML = `
                <div class="space-y-6 fade-in">
                    <div class="bg-gradient-to-r from-amber-800 to-orange-900 rounded-3xl p-6 text-white">
                        <span class="px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider">Almacén de Consumibles TI</span>
                        <h3 class="text-xl font-extrabold mt-2">Gestión de Tintas y Tóner por Campus</h3>
                        <p class="text-xs text-amber-100 mt-1">Cada recarga registrada en tickets descuenta 1 unidad automáticamente. Alerta crítica al llegar a 1 unidad.</p>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-amber-200/80">
                        <h4 class="text-sm font-bold text-amber-950 mb-4">Registrar o Actualizar Stock de Tinta / Tóner</h4>
                        <form onsubmit="submitInkStock(event)" class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Campus *</label>
                                <select id="ink-campus" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white">
                                    ${appState.catalogs.campus.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Código / Modelo de Tinta *</label>
                                <select id="ink-code" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white">
                                    ${appState.catalogs.modelosTinta.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Cantidad en Stock *</label>
                                <input type="number" id="ink-stock" min="0" required value="5" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition">
                                <i class="fa-solid fa-floppy-disk mr-1"></i>Guardar Stock
                            </button>
                        </form>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        ${appState.catalogs.campus.map(campus => {
                            const campusInks = appState.inks.filter(i => i.campus.toLowerCase() === campus.toLowerCase());
                            return `
                                <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                                    <div class="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                        <h4 class="text-sm font-extrabold text-amber-950">Campus ${escapeHtml(campus)}</h4>
                                        <span class="text-[11px] font-bold text-amber-700">${campusInks.length} modelos</span>
                                    </div>
                                    <div class="p-4 space-y-2.5">
                                        ${campusInks.length === 0 ? `
                                            <p class="text-xs text-slate-400 text-center py-6">Sin tintas registradas en esta sede.</p>
                                        ` : campusInks.map(ink => {
                                            const critical = Number(ink.stock) <= 1;
                                            return `
                                                <div class="p-3 rounded-xl border ${critical ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} flex items-center justify-between gap-2">
                                                    <div>
                                                        <p class="text-xs font-bold text-slate-800">${escapeHtml(ink.code)}</p>
                                                        ${critical ? `<span class="text-[10px] font-extrabold text-red-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Stock crítico (≤ 1)</span>` : `<span class="text-[10px] text-slate-500">Disponible</span>`}
                                                    </div>
                                                    <div class="flex items-center gap-1.5">
                                                        <button onclick="adjustInkStock('${ink.id}', -1)" class="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100">-</button>
                                                        <span class="w-8 text-center text-xs font-extrabold ${critical ? 'text-red-600' : 'text-slate-900'}">${ink.stock}</span>
                                                        <button onclick="adjustInkStock('${ink.id}', 1)" class="w-7 h-7 rounded-lg bg-white border border-slate-300 text-xs font-bold hover:bg-slate-100">+</button>
                                                        <button onclick="deleteInkItem('${ink.id}')" class="w-7 h-7 rounded-lg text-red-500 hover:bg-red-100 text-xs"><i class="fa-solid fa-trash"></i></button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        function submitInkStock(e) {
            e.preventDefault();
            const campus = document.getElementById('ink-campus').value;
            const code = document.getElementById('ink-code').value;
            const stock = parseInt(document.getElementById('ink-stock').value, 10) || 0;

            const existing = appState.inks.find(i => i.campus.toLowerCase() === campus.toLowerCase() && i.code.toLowerCase() === code.toLowerCase());
            if (existing) {
                existing.stock = stock;
            } else {
                appState.inks.push({ id: 'ink_' + Date.now(), campus, code, stock });
            }

            saveState();
            renderGlobalAlerts();
            renderInksView();
            showToast(`Stock de ${code} en ${campus} actualizado a ${stock}.`);
        }

        function adjustInkStock(id, delta) {
            const ink = appState.inks.find(i => i.id === id);
            if (!ink) return;
            ink.stock = Math.max(0, Number(ink.stock) + delta);
            saveState();
            renderGlobalAlerts();
            renderInksView();
        }

        function deleteInkItem(id) {
            appState.inks = appState.inks.filter(i => i.id !== id);
            saveState();
            renderGlobalAlerts();
            renderInksView();
            showToast('Modelo eliminado del inventario del campus.');
        }

        /* ==========================================================================
           13. PANEL DE REGISTROS (SOLO ADMINISTRADOR CON EDICIÓN PROTEGIDA)
           ========================================================================== */
        let recordsTab = 'tickets';
        let recordsFromDate = '';
        let recordsToDate = '';
        let recordsSearch = '';

        function renderRecordsView() {
            if (currentUser.role !== 'admin') return;
            const container = document.getElementById('view-container');

            const q = recordsSearch.toLowerCase();

            const filteredTickets = appState.tickets.filter(t => {
                if (recordsFromDate && t.closeDate < recordsFromDate) return false;
                if (recordsToDate && t.closeDate > recordsToDate) return false;
                if (q && !`${t.code} ${t.userName} ${t.userLastname} ${t.service} ${t.campus} ${t.techName}`.toLowerCase().includes(q)) return false;
                return true;
            });

            const filteredEvents = appState.events.filter(ev => {
                if (recordsFromDate && ev.date < recordsFromDate) return false;
                if (recordsToDate && ev.date > recordsToDate) return false;
                if (q && !`${ev.code} ${ev.eventName} ${ev.responsible} ${ev.campus} ${ev.techName}`.toLowerCase().includes(q)) return false;
                return true;
            });

            container.innerHTML = `
                <div class="space-y-5 fade-in">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-end justify-between gap-4">
                        <div class="flex flex-wrap items-end gap-3">
                            <div class="flex rounded-xl bg-slate-100 p-1">
                                <button onclick="recordsTab = 'tickets'; renderRecordsView();" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${recordsTab === 'tickets' ? 'bg-brand text-white' : 'text-slate-600'}">
                                    Tickets (${filteredTickets.length})
                                </button>
                                <button onclick="recordsTab = 'events'; renderRecordsView();" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${recordsTab === 'events' ? 'bg-brand text-white' : 'text-slate-600'}">
                                    Eventos (${filteredEvents.length})
                                </button>
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Desde</label>
                                <input type="date" value="${recordsFromDate}" onchange="recordsFromDate = this.value; renderRecordsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Hasta</label>
                                <input type="date" value="${recordsToDate}" onchange="recordsToDate = this.value; renderRecordsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Buscar</label>
                                <input type="text" value="${escapeHtml(recordsSearch)}" oninput="recordsSearch = this.value; renderRecordsView();" placeholder="Código, usuario, campus..." class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                            </div>
                        </div>
                        <button onclick="downloadRecordsCsv()" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition">
                            <i class="fa-solid fa-download mr-1.5"></i>Descargar Base de Datos
                        </button>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200/80 overflow-x-auto">
                        ${recordsTab === 'tickets' ? `
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                        <th class="p-3">N° Ticket</th>
                                        <th class="p-3">Fecha / Hora</th>
                                        <th class="p-3">Campus / Ambiente</th>
                                        <th class="p-3">Usuario / Colaborador</th>
                                        <th class="p-3">Servicio</th>
                                        <th class="p-3">Técnico</th>
                                        <th class="p-3">Estado</th>
                                        <th class="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${filteredTickets.length === 0 ? `<tr><td colspan="8" class="p-8 text-center text-slate-400">Sin registros de tickets.</td></tr>` : filteredTickets.slice().reverse().map(t => `
                                        <tr class="hover:bg-slate-50">
                                            <td class="p-3 font-extrabold text-brand">${escapeHtml(t.code)}</td>
                                            <td class="p-3">${formatDateDisplay(t.closeDate)} ${escapeHtml(t.closeTime)}</td>
                                            <td class="p-3">${escapeHtml(t.campus)} - ${escapeHtml(t.place)} (${escapeHtml(t.room)})</td>
                                            <td class="p-3">${escapeHtml(t.userName)} ${escapeHtml(t.userLastname)} <span class="text-slate-400">(${escapeHtml(t.collaborator)})</span></td>
                                            <td class="p-3 font-semibold">${escapeHtml(t.service)} ${t.inkModel && t.service.toLowerCase().includes('tinta') ? `[${escapeHtml(t.inkModel)}]` : ''}</td>
                                            <td class="p-3">${escapeHtml(t.techName)}</td>
                                            <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-[10px]">${escapeHtml(t.status)}</span></td>
                                            <td class="p-3 text-right space-x-1 whitespace-nowrap">
                                                <button onclick="openAutoHtmlPreviewById('ticket', '${t.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-brand hover:text-white rounded-lg font-semibold">HTML/IMG</button>
                                                <button onclick="openTicketFormModal('${t.id}')" class="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg font-semibold">Editar (Clave)</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : `
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                        <th class="p-3">N° RQ</th>
                                        <th class="p-3">Fecha / Horario</th>
                                        <th class="p-3">Evento / Tipo</th>
                                        <th class="p-3">Campus</th>
                                        <th class="p-3">Responsable / Cel</th>
                                        <th class="p-3">Equipos</th>
                                        <th class="p-3">Técnico</th>
                                        <th class="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${filteredEvents.length === 0 ? `<tr><td colspan="8" class="p-8 text-center text-slate-400">Sin registros de eventos.</td></tr>` : filteredEvents.slice().reverse().map(ev => `
                                        <tr class="hover:bg-slate-50">
                                            <td class="p-3 font-extrabold text-slate-900">${escapeHtml(ev.code)}</td>
                                            <td class="p-3">${formatDateDisplay(ev.date)} (${escapeHtml(ev.startTime)}-${escapeHtml(ev.endTime)})</td>
                                            <td class="p-3 font-semibold">${escapeHtml(ev.eventName)} <span class="text-brand">(${escapeHtml(ev.eventType)})</span></td>
                                            <td class="p-3">${escapeHtml(ev.campus)}</td>
                                            <td class="p-3">${escapeHtml(ev.responsible)} (${escapeHtml(ev.phone)})</td>
                                            <td class="p-3">${escapeHtml((ev.equipments || []).join(', '))}</td>
                                            <td class="p-3">${escapeHtml(ev.techName)}</td>
                                            <td class="p-3 text-right space-x-1 whitespace-nowrap">
                                                <button onclick="openAutoHtmlPreviewById('event', '${ev.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-brand hover:text-white rounded-lg font-semibold">HTML/IMG</button>
                                                <button onclick="openEventFormModal('${ev.id}')" class="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg font-semibold">Editar (Clave)</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
            `;
        }

        function downloadRecordsCsv() {
            if (recordsTab === 'tickets') {
                const headers = ['Codigo', 'Canal', 'Campus', 'Lugar', 'Ambiente', 'Nombres', 'Apellidos', 'Colaborador', 'Servicio', 'Tinta', 'Tecnico', 'Prioridad', 'Estado', 'Fecha Cierre', 'Hora Cierre', 'Observaciones'];
                const rows = appState.tickets.map(t => [t.code, t.channel, t.campus, t.place, t.room, t.userName, t.userLastname, t.collaborator, t.service, t.inkModel, t.techName, t.priority, t.status, t.closeDate, t.closeTime, t.obs]);
                downloadCsvFile('registros_tickets_upfr.csv', headers, rows);
            } else {
                const headers = ['Codigo', 'Canal', 'Evento', 'Tipo', 'Campus', 'Escuela', 'Fecha', 'Inicio', 'Fin', 'Responsable', 'Celular', 'Equipos', 'Tecnico', 'Prioridad', 'Estado', 'Observaciones'];
                const rows = appState.events.map(e => [e.code, e.channel, e.eventName, e.eventType, e.campus, e.school, e.date, e.startTime, e.endTime, e.responsible, e.phone, (e.equipments || []).join(' | '), e.techName, e.priority, e.status, e.obs]);
                downloadCsvFile('registros_eventos_upfr.csv', headers, rows);
            }
        }

        function downloadCsvFile(filename, headers, rows) {
            const csvContent = [headers, ...rows]
                .map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            showToast(`Archivo ${filename} descargado.`);
        }

        /* ==========================================================================
           14. PANEL DE REPORTES CON GRÁFICOS DESCARGABLES (SOLO ADMIN)
           ========================================================================== */
        let reportPeriod = 'all';
        let reportFrom = '';
        let reportTo = '';
        let reportTech = 'ALL';

        function renderReportsView() {
            if (currentUser.role !== 'admin') return;
            const container = document.getElementById('view-container');

            const now = new Date();
            const todayStr = getTodayStr();

            function matchPeriod(dateStr) {
                if (!dateStr) return true;
                if (reportFrom && dateStr < reportFrom) return false;
                if (reportTo && dateStr > reportTo) return false;
                if (reportPeriod === 'day') return dateStr === todayStr;
                if (reportPeriod === 'week') {
                    const d = new Date(dateStr + 'T00:00:00');
                    const diffDays = (now - d) / (1000 * 60 * 60 * 24);
                    return diffDays >= 0 && diffDays <= 7;
                }
                if (reportPeriod === 'year') {
                    return dateStr.startsWith(String(now.getFullYear()));
                }
                return true;
            }

            const fTickets = appState.tickets.filter(t => matchPeriod(t.closeDate) && (reportTech === 'ALL' || t.techId === reportTech));
            const fEvents = appState.events.filter(e => matchPeriod(e.date) && (reportTech === 'ALL' || e.techId === reportTech));

            container.innerHTML = `
                <div class="space-y-6 fade-in">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-wrap items-end justify-between gap-4">
                        <div class="flex flex-wrap items-end gap-3">
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Periodo Rápido</label>
                                <select onchange="reportPeriod = this.value; renderReportsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white">
                                    <option value="all" ${reportPeriod === 'all' ? 'selected' : ''}>Todo el historial</option>
                                    <option value="day" ${reportPeriod === 'day' ? 'selected' : ''}>Hoy (Día)</option>
                                    <option value="week" ${reportPeriod === 'week' ? 'selected' : ''}>Última Semana</option>
                                    <option value="year" ${reportPeriod === 'year' ? 'selected' : ''}>Este Año</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Desde</label>
                                <input type="date" value="${reportFrom}" onchange="reportFrom = this.value; renderReportsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Hasta</label>
                                <input type="date" value="${reportTo}" onchange="reportTo = this.value; renderReportsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Técnico</label>
                                <select onchange="reportTech = this.value; renderReportsView();" class="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white">
                                    <option value="ALL" ${reportTech === 'ALL' ? 'selected' : ''}>Todos</option>
                                    ${appState.users.map(u => `<option value="${u.id}" ${reportTech === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <button onclick="downloadReportSummaryCsv()" class="px-4 py-2 bg-brand hover:bg-brand-light text-white text-xs font-semibold rounded-xl transition">
                            <i class="fa-solid fa-file-excel mr-1.5"></i>Descargar Reporte CSV
                        </button>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div class="bg-white p-5 rounded-2xl border border-slate-200/80">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="text-xs font-bold text-slate-800">Atenciones por Técnico</h4>
                                <button onclick="downloadChartImage('chart-tech', 'reporte_tecnicos.png')" class="text-[11px] text-brand font-semibold hover:underline">Descargar PNG</button>
                            </div>
                            <canvas id="chart-tech" height="220"></canvas>
                        </div>

                        <div class="bg-white p-5 rounded-2xl border border-slate-200/80">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="text-xs font-bold text-slate-800">Tickets por Servicio</h4>
                                <button onclick="downloadChartImage('chart-services', 'reporte_servicios.png')" class="text-[11px] text-brand font-semibold hover:underline">Descargar PNG</button>
                            </div>
                            <canvas id="chart-services" height="220"></canvas>
                        </div>

                        <div class="bg-white p-5 rounded-2xl border border-slate-200/80">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="text-xs font-bold text-slate-800">Eventos por Campus</h4>
                                <button onclick="downloadChartImage('chart-campus', 'reporte_campus.png')" class="text-[11px] text-brand font-semibold hover:underline">Descargar PNG</button>
                            </div>
                            <canvas id="chart-campus" height="220"></canvas>
                        </div>
                    </div>
                </div>
            `;

            Object.values(chartInstances).forEach(ch => ch && ch.destroy());
            chartInstances = {};

            const techLabels = appState.users.map(u => u.name);
            const techTicketCounts = appState.users.map(u => fTickets.filter(t => t.techId === u.id).length);
            const techEventCounts = appState.users.map(u => fEvents.filter(e => e.techId === u.id).length);

            chartInstances.tech = new Chart(document.getElementById('chart-tech'), {
                type: 'bar',
                data: {
                    labels: techLabels,
                    datasets: [
                        { label: 'Tickets', data: techTicketCounts, backgroundColor: '#910048', borderRadius: 6 },
                        { label: 'Eventos', data: techEventCounts, backgroundColor: '#141829', borderRadius: 6 }
                    ]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });

            const serviceLabels = appState.catalogs.servicios;
            const serviceCounts = serviceLabels.map(s => fTickets.filter(t => t.service === s).length);
            chartInstances.services = new Chart(document.getElementById('chart-services'), {
                type: 'doughnut',
                data: {
                    labels: serviceLabels,
                    datasets: [{
                        data: serviceCounts,
                        backgroundColor: ['#910048', '#141829', '#2563eb', '#d97706', '#059669', '#7c3aed']
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });

            const campusLabels = appState.catalogs.campus;
            const campusEventCounts = campusLabels.map(c => fEvents.filter(e => e.campus === c).length);
            chartInstances.campus = new Chart(document.getElementById('chart-campus'), {
                type: 'bar',
                data: {
                    labels: campusLabels,
                    datasets: [{ label: 'Eventos', data: campusEventCounts, backgroundColor: '#910048', borderRadius: 6 }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }

        function downloadChartImage(canvasId, filename) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast(`Gráfico ${filename} descargado.`);
        }

        function downloadReportSummaryCsv() {
            const headers = ['Tipo', 'Codigo', 'Fecha', 'Campus', 'Detalle', 'Tecnico', 'Estado'];
            const rows = [
                ...appState.tickets.map(t => ['Ticket', t.code, t.closeDate, t.campus, t.service, t.techName, t.status]),
                ...appState.events.map(e => ['Evento', e.code, e.date, e.campus, e.eventName, e.techName, e.status])
            ];
            downloadCsvFile('reporte_general_ti_upfr.csv', headers, rows);
        }

        /* ==========================================================================
           15. PANEL DE MANTENIMIENTO EN VIVO (CATÁLOGOS, USUARIOS Y PLANTILLA HTML)
           ========================================================================== */
        function renderMaintenanceView() {
            if (currentUser.role !== 'admin') return;
            const container = document.getElementById('view-container');
            const tpl = appState.htmlTemplate;

            const catalogMeta = [
                { key: 'canales', label: 'Canal de Requerimiento' },
                { key: 'campus', label: 'Campus Universitarios' },
                { key: 'lugares', label: 'Lugar de Atención' },
                { key: 'colaboradores', label: 'Tipo de Colaborador' },
                { key: 'servicios', label: 'Servicios Requeridos (Tickets)' },
                { key: 'modelosTinta', label: 'Modelos de Tinta / Tóner' },
                { key: 'prioridades', label: 'Prioridades' },
                { key: 'estados', label: 'Estados de Requerimiento' },
                { key: 'tiposEvento', label: 'Tipos de Evento' },
                { key: 'escuelas', label: 'Escuelas Profesionales' },
                { key: 'equipos', label: 'Equipos Solicitados (Eventos)' }
            ];

            container.innerHTML = `
                <div class="space-y-8 fade-in">
                    <div class="bg-white p-6 rounded-2xl border border-brand-border">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-sm font-extrabold text-brand">Mantenimiento de Ventana de Imagen y Código HTML</h3>
                                <p class="text-xs text-slate-500">Personalice los textos y colores del comprobante automático para Tickets, Eventos y Licencias Meet</p>
                            </div>
                        </div>

                        <form onsubmit="saveHtmlTemplateSettings(event)" class="space-y-4">
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Título Principal Cabecera</label>
                                    <input type="text" id="tpl-header-title" required value="${escapeHtml(tpl.headerTitle)}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Subtítulo Cabecera</label>
                                    <input type="text" id="tpl-header-subtitle" required value="${escapeHtml(tpl.headerSubtitle)}" class="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Color Institucional Base</label>
                                    <input type="color" id="tpl-primary-color" value="${escapeHtml(tpl.primaryColor)}" class="w-full h-9 px-2 py-1 border border-slate-300 rounded-xl bg-white">
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                    <p class="text-xs font-bold text-brand">Adaptación: Tickets TI</p>
                                    <label class="block text-[11px] font-semibold text-slate-600">Texto Introductorio</label>
                                    <textarea id="tpl-ticket-intro" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.ticketIntro)}</textarea>
                                    <label class="block text-[11px] font-semibold text-slate-600">Nota Importante</label>
                                    <textarea id="tpl-ticket-note" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.ticketNote)}</textarea>
                                </div>

                                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                    <p class="text-xs font-bold text-slate-900">Adaptación: Eventos</p>
                                    <label class="block text-[11px] font-semibold text-slate-600">Texto Introductorio</label>
                                    <textarea id="tpl-event-intro" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.eventIntro)}</textarea>
                                    <label class="block text-[11px] font-semibold text-slate-600">Nota Importante</label>
                                    <textarea id="tpl-event-note" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.eventNote)}</textarea>
                                </div>

                                <div class="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                                    <p class="text-xs font-bold text-blue-800">Adaptación: Licencias Meet</p>
                                    <label class="block text-[11px] font-semibold text-slate-600">Texto Introductorio</label>
                                    <textarea id="tpl-meet-intro" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.meetIntro)}</textarea>
                                    <label class="block text-[11px] font-semibold text-slate-600">Nota Importante</label>
                                    <textarea id="tpl-meet-note" rows="2" class="w-full p-2 text-xs border border-slate-300 rounded-lg">${escapeHtml(tpl.meetNote)}</textarea>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Área / Oficina Pie</label>
                                    <input type="text" id="tpl-footer-org" value="${escapeHtml(tpl.footerOrg)}" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Universidad</label>
                                    <input type="text" id="tpl-footer-uni" value="${escapeHtml(tpl.footerUni)}" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
                                    <input type="text" id="tpl-footer-address" value="${escapeHtml(tpl.footerAddress)}" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-700 mb-1">Celular Soporte</label>
                                    <input type="text" id="tpl-footer-phone" value="${escapeHtml(tpl.footerPhone)}" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                                </div>
                            </div>

                            <div class="flex justify-end">
                                <button type="submit" class="px-5 py-2.5 bg-brand hover:bg-brand-light text-white text-xs font-bold rounded-xl transition">
                                    Guardar Plantilla HTML/Imagen
                                </button>
                            </div>
                        </form>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-slate-200/80">
                        <h3 class="text-sm font-extrabold text-slate-900 mb-1">Mantenimiento de Ítems de Fichas (Reflejo Inmediato)</h3>
                        <p class="text-xs text-slate-500 mb-5">Agregue o elimine opciones de los formularios de Tickets y Eventos con mensaje de validación.</p>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${catalogMeta.map(cat => {
                                const items = appState.catalogs[cat.key] || [];
                                return `
                                    <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                                        <div>
                                            <h4 class="text-xs font-extrabold text-slate-800 mb-2.5">${escapeHtml(cat.label)}</h4>
                                            <div class="flex flex-wrap gap-1.5 mb-3">
                                                ${items.map((item, idx) => `
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700">
                                                        <span>${escapeHtml(item)}</span>
                                                        <button type="button" onclick="removeCatalogItem('${cat.key}', ${idx})" class="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                        <div class="flex gap-1.5 pt-2 border-t border-slate-200/70">
                                            <input type="text" id="cat-input-${cat.key}" placeholder="Nuevo ítem..." class="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg">
                                            <button type="button" onclick="addCatalogItem('${cat.key}')" class="px-3 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-light">+</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl border border-slate-200/80">
                        <h3 class="text-sm font-extrabold text-slate-900 mb-1">Mantenimiento de Personal (Administradores y Técnicos)</h3>
                        <p class="text-xs text-slate-500 mb-5">Cree nuevos integrantes, edite nombres, contraseñas o fotos de perfil.</p>

                        <form onsubmit="addNewSystemUser(event)" class="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 items-end">
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Nombre Completo *</label>
                                <input type="text" id="new-user-name" required oninput="sanitizeOnlyLetters(this)" placeholder="Ej: Carlos Perez" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Usuario Login *</label>
                                <input type="text" id="new-user-username" required placeholder="Ej: carlos" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Contraseña *</label>
                                <input type="text" id="new-user-password" required value="123" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Cargo *</label>
                                <select id="new-user-role" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl">
                                    <option value="tech">Técnico</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button type="submit" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition">
                                + Crear Usuario
                            </button>
                        </form>

                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${appState.users.map(u => `
                                <div class="p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <img src="${u.avatar || getAvatarUrl(u.name)}" alt="${escapeHtml(u.name)}" class="w-11 h-11 rounded-full object-cover border-2 border-brand shrink-0">
                                        <div class="min-w-0">
                                            <p class="text-xs font-extrabold text-slate-900 truncate">${escapeHtml(u.name)}</p>
                                            <p class="text-[11px] text-slate-500">@${escapeHtml(u.username)} • ${u.role === 'admin' ? 'Administrador' : 'Técnico'}</p>
                                            <p class="text-[10px] text-slate-400">Clave: ${escapeHtml(u.password)}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <button onclick="openProfilePhotoModal('${u.id}')" title="Cambiar foto" class="p-2 text-slate-500 hover:text-brand hover:bg-brand-soft rounded-lg text-xs">
                                            <i class="fa-solid fa-camera"></i>
                                        </button>
                                        <button onclick="editSystemUser('${u.id}')" title="Editar nombre/clave" class="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        ${u.id !== currentUser.id ? `
                                            <button onclick="deleteSystemUser('${u.id}')" title="Eliminar usuario" class="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        function saveHtmlTemplateSettings(e) {
            e.preventDefault();
            openConfirmDialog({
                title: 'Confirmar Cambios en Plantilla HTML/Imagen',
                message: '¿Desea guardar la nueva configuración visual del comprobante automático?',
                okText: 'Guardar Plantilla',
                onConfirm: () => {
                    appState.htmlTemplate = {
                        ...appState.htmlTemplate,
                        headerTitle: document.getElementById('tpl-header-title').value.trim() || 'CONFIRMADO',
                        headerSubtitle: document.getElementById('tpl-header-subtitle').value.trim(),
                        primaryColor: document.getElementById('tpl-primary-color').value || '#910048',
                        ticketIntro: document.getElementById('tpl-ticket-intro').value.trim(),
                        ticketNote: document.getElementById('tpl-ticket-note').value.trim(),
                        eventIntro: document.getElementById('tpl-event-intro').value.trim(),
                        eventNote: document.getElementById('tpl-event-note').value.trim(),
                        meetIntro: document.getElementById('tpl-meet-intro').value.trim(),
                        meetNote: document.getElementById('tpl-meet-note').value.trim(),
                        footerOrg: document.getElementById('tpl-footer-org').value.trim(),
                        footerUni: document.getElementById('tpl-footer-uni').value.trim(),
                        footerAddress: document.getElementById('tpl-footer-address').value.trim(),
                        footerPhone: document.getElementById('tpl-footer-phone').value.trim()
                    };
                    saveState();
                    showToast('Plantilla HTML/Imagen actualizada.');
                }
            });
        }

        function addCatalogItem(key) {
            const input = document.getElementById(`cat-input-${key}`);
            const val = (input.value || '').trim();
            if (!val) {
                showToast('Ingrese un valor antes de agregar.', 'warning');
                return;
            }
            if ((appState.catalogs[key] || []).some(i => i.toLowerCase() === val.toLowerCase())) {
                showToast('Ese ítem ya existe en la lista.', 'warning');
                return;
            }
            openConfirmDialog({
                title: 'Confirmar Nuevo Ítem',
                message: `¿Desea agregar <strong>${escapeHtml(val)}</strong> a la ficha? Se reflejará de inmediato en los formularios.`,
                okText: 'Agregar',
                onConfirm: () => {
                    appState.catalogs[key].push(val);
                    saveState();
                    renderMaintenanceView();
                    showToast(`Ítem "${val}" agregado.`);
                }
            });
        }

        function removeCatalogItem(key, index) {
            const list = appState.catalogs[key] || [];
            if (list.length <= 1) {
                showToast('Debe existir al menos 1 ítem en la lista.', 'warning');
                return;
            }
            const val = list[index];
            openConfirmDialog({
                title: 'Confirmar Eliminación de Ítem',
                message: `¿Está seguro de eliminar <strong>${escapeHtml(val)}</strong>?`,
                okText: 'Eliminar',
                onConfirm: () => {
                    appState.catalogs[key].splice(index, 1);
                    saveState();
                    renderMaintenanceView();
                    showToast(`Ítem "${val}" eliminado.`);
                }
            });
        }

        function addNewSystemUser(e) {
            e.preventDefault();
            const name = document.getElementById('new-user-name').value.trim();
            const username = document.getElementById('new-user-username').value.trim().toLowerCase();
            const password = document.getElementById('new-user-password').value.trim();
            const role = document.getElementById('new-user-role').value;

            if (appState.users.some(u => u.username.toLowerCase() === username)) {
                showToast('Ese nombre de usuario ya está registrado.', 'error');
                return;
            }

            openConfirmDialog({
                title: 'Crear Nuevo Usuario',
                message: `¿Desea crear el usuario <strong>${escapeHtml(name)}</strong> (@${escapeHtml(username)})?`,
                okText: 'Crear Usuario',
                onConfirm: () => {
                    appState.users.push({
                        id: 'u_' + Date.now(),
                        username,
                        password,
                        name,
                        role,
                        avatar: getAvatarUrl(name, role === 'admin' ? '910048' : '141829')
                    });
                    saveState();
                    renderMaintenanceView();
                    showToast(`Usuario ${name} creado.`);
                }
            });
        }

        function editSystemUser(userId) {
            const user = appState.users.find(u => u.id === userId);
            if (!user) return;
            openConfirmDialog({
                title: `Editar Usuario (@${user.username})`,
                message: `
                    <div class="space-y-3 mt-2">
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
                            <input type="text" id="edit-usr-name" value="${escapeHtml(user.name)}" oninput="sanitizeOnlyLetters(this)" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
                            <input type="text" id="edit-usr-pass" value="${escapeHtml(user.password)}" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">
                        </div>
                    </div>
                `,
                okText: 'Guardar Cambios',
                onConfirm: () => {
                    const newName = document.getElementById('edit-usr-name').value.trim();
                    const newPass = document.getElementById('edit-usr-pass').value.trim();
                    if (newName) user.name = newName;
                    if (newPass) user.password = newPass;
                    saveState();
                    if (user.id === currentUser.id) {
                        currentUser = user;
                        updateSidebarProfile();
                    }
                    renderMaintenanceView();
                    showToast('Datos de usuario actualizados.');
                }
            });
        }

        function deleteSystemUser(userId) {
            const user = appState.users.find(u => u.id === userId);
            if (!user) return;
            openConfirmDialog({
                title: 'Eliminar Usuario',
                message: `¿Está seguro de eliminar a <strong>${escapeHtml(user.name)}</strong>?`,
                okText: 'Eliminar Usuario',
                onConfirm: () => {
                    appState.users = appState.users.filter(u => u.id !== userId);
                    saveState();
                    renderMaintenanceView();
                    showToast('Usuario eliminado.');
                }
            });
        }

        /* ==========================================================================
           16. SCRIPT SQL DE BASE DE DATOS Y EXPORTACIÓN EN CARPETAS (.ZIP)
           ========================================================================== */
        function getEnvFileContent(isExample = false) {
            return [
                '# ============================================================================',
                '# VARIABLES DE ENTORNO - GESTIÓN TI & EVENTOS (OTI - UPFR)',
                '# ============================================================================',
                'APP_NAME="Gestion TI y Eventos UPFR"',
                'APP_ENV=production',
                'APP_DEBUG=false',
                'APP_URL=http://localhost/gestion-ti-upfr',
                'APP_TIMEZONE=America/Lima',
                '',
                '# BASE DE DATOS MYSQL / MARIADB',
                'DB_CONNECTION=mysql',
                'DB_HOST=127.0.0.1',
                'DB_PORT=3306',
                'DB_DATABASE=upfr_gestion_ti',
                isExample ? 'DB_USERNAME=usuario_mysql' : 'DB_USERNAME=root',
                isExample ? 'DB_PASSWORD=cambiar_clave_segura' : 'DB_PASSWORD=',
                '',
                '# PARÁMETROS DEL SISTEMA TI',
                'INSTITUTION_NAME="Universidad Privada Franklin Roosevelt"',
                'INSTITUTION_AREA="Oficina de Tecnologías de la Información"',
                'INSTITUTION_COLOR=#910048',
                'MEET_LICENSES_TOTAL=100',
                'INK_CRITICAL_STOCK=1',
                'DEFAULT_USER_PASSWORD=123'
            ].join('\n');
        }

        function getGitignoreContent() {
            return [
                '# Variables de entorno con credenciales',
                '.env',
                '.env.local',
                '.env.*.local',
                '',
                '# Carpetas de editores y sistema operativo',
                '.vscode/',
                '.idea/',
                '.DS_Store',
                'Thumbs.db',
                '',
                '# Logs y archivos temporales',
                '*.log',
                '*.tmp'
            ].join('\n');
        }

        function getSqlDatabaseScript() {
            return [
                '-- ============================================================================',
                '-- BASE DE DATOS: GESTIÓN DE TICKETS Y EVENTOS TI',
                '-- UNIVERSIDAD PRIVADA FRANKLIN ROOSEVELT',
                '-- ============================================================================',
                'CREATE DATABASE IF NOT EXISTS upfr_gestion_ti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
                'USE upfr_gestion_ti;',
                '',
                'CREATE TABLE usuarios (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    username VARCHAR(50) NOT NULL UNIQUE,',
                '    password VARCHAR(255) NOT NULL DEFAULT \'123\',',
                '    nombre_completo VARCHAR(120) NOT NULL,',
                '    rol ENUM(\'admin\', \'tech\') NOT NULL DEFAULT \'tech\',',
                '    avatar_url TEXT,',
                '    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                ');',
                '',
                'CREATE TABLE catalogos_items (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    categoria VARCHAR(50) NOT NULL,',
                '    valor VARCHAR(120) NOT NULL,',
                '    activo TINYINT(1) DEFAULT 1',
                ');',
                '',
                'CREATE TABLE inventario_tintas (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    campus VARCHAR(80) NOT NULL,',
                '    codigo_tinta VARCHAR(100) NOT NULL,',
                '    stock INT NOT NULL DEFAULT 0,',
                '    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                ');',
                '',
                'CREATE TABLE tickets_atencion (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    codigo_ticket VARCHAR(25) NOT NULL UNIQUE,',
                '    tecnico_id INT NOT NULL,',
                '    canal VARCHAR(50) NOT NULL,',
                '    campus VARCHAR(80) NOT NULL,',
                '    lugar_atencion VARCHAR(80) NOT NULL,',
                '    ambiente_detalle VARCHAR(150) NOT NULL,',
                '    nombres_usuario VARCHAR(100) NOT NULL,',
                '    apellidos_usuario VARCHAR(100) NOT NULL,',
                '    colaborador VARCHAR(80) NOT NULL,',
                '    servicio_requerido VARCHAR(120) NOT NULL,',
                '    modelo_tinta VARCHAR(100) NULL,',
                '    prioridad VARCHAR(40) NOT NULL,',
                '    estado VARCHAR(40) NOT NULL,',
                '    observaciones VARCHAR(200) NULL,',
                '    fecha_cierre DATE NOT NULL,',
                '    hora_cierre TIME NOT NULL,',
                '    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
                '    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)',
                ');',
                '',
                'CREATE TABLE requerimientos_eventos (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    codigo_rq VARCHAR(25) NOT NULL UNIQUE,',
                '    tecnico_id INT NOT NULL,',
                '    canal VARCHAR(50) NOT NULL,',
                '    nombre_evento VARCHAR(200) NOT NULL,',
                '    tipo_evento VARCHAR(80) NOT NULL,',
                '    campus VARCHAR(80) NOT NULL,',
                '    escuela_profesional VARCHAR(120) NULL,',
                '    fecha_evento DATE NOT NULL,',
                '    hora_inicio TIME NOT NULL,',
                '    hora_fin TIME NOT NULL,',
                '    persona_responsable VARCHAR(120) NOT NULL,',
                '    celular VARCHAR(20) NOT NULL,',
                '    equipos_solicitados TEXT NOT NULL,',
                '    prioridad VARCHAR(40) NOT NULL,',
                '    estado VARCHAR(40) NOT NULL,',
                '    observaciones VARCHAR(200) NULL,',
                '    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
                '    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)',
                ');',
                '',
                'CREATE TABLE licencias_meet (',
                '    id INT AUTO_INCREMENT PRIMARY KEY,',
                '    codigo_ticket VARCHAR(25) NOT NULL,',
                '    tecnico_id INT NOT NULL,',
                '    nombres_usuario VARCHAR(100) NOT NULL,',
                '    apellidos_usuario VARCHAR(100) NOT NULL,',
                '    correo_asignado VARCHAR(150) NOT NULL,',
                '    fecha_inicio DATE NOT NULL,',
                '    fecha_fin DATE NOT NULL,',
                '    estado ENUM(\'ACTIVO\', \'RETIRADO\') NOT NULL DEFAULT \'ACTIVO\',',
                '    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,',
                '    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)',
                ');',
                '',
                '-- DATOS INICIALES DE PRODUCCIÓN',
                'INSERT INTO usuarios (username, password, nombre_completo, rol) VALUES',
                '(\'admin\', \'123\', \'Administrador TI\', \'admin\'),',
                '(\'tecnico\', \'123\', \'Tecnico TI\', \'tech\');'
            ].join('\n');
        }

        function renderSqlView() {
            if (currentUser.role !== 'admin') return;
            const container = document.getElementById('view-container');
            const sqlText = getSqlDatabaseScript();
            const envText = getEnvFileContent(false);

            container.innerHTML = `
                <div class="space-y-6 fade-in">
                    <!-- Tarjeta de Exportación del Proyecto en Carpetas para Git -->
                    <div class="bg-white p-6 rounded-2xl border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <span class="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-bold">Listo para Repositorio Git</span>
                            <h3 class="text-sm font-extrabold text-slate-900 mt-1.5">Exportar Proyecto en Carpetas + Archivos Git (.ZIP)</h3>
                            <p class="text-xs text-slate-500 mt-0.5">Incluye <strong>index.html</strong>, <strong>css/styles.css</strong>, <strong>js/app.js</strong>, <strong>database/upfr_gestion_ti.sql</strong>, <strong>.env</strong>, <strong>.env.example</strong> y <strong>.gitignore</strong>.</p>
                        </div>
                        <button onclick="downloadProjectZip()" class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0">
                            <i class="fa-brands fa-git-alt text-orange-400 text-sm"></i>
                            <span>Descargar Proyecto Git (.ZIP)</span>
                        </button>
                    </div>

                    <!-- Visor y Descarga Directa de Archivo .env -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 class="text-sm font-extrabold text-slate-900">Archivo de Variables de Entorno (.env)</h3>
                                <p class="text-xs text-slate-500">Configuración de servidor, puerto, base de datos MySQL y parámetros institucionales</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="copyEnvFile()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition">
                                    <i class="fa-solid fa-copy mr-1"></i>Copiar .env
                                </button>
                                <button onclick="downloadEnvFile()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition">
                                    <i class="fa-solid fa-download mr-1"></i>Descargar .env
                                </button>
                            </div>
                        </div>
                        <textarea id="env-file-textarea" readonly rows="12" class="w-full p-4 text-xs font-mono bg-slate-900 text-sky-300 rounded-2xl border border-slate-700 focus:outline-none">${escapeHtml(envText)}</textarea>
                    </div>

                    <!-- Visor de Script SQL -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 class="text-sm font-extrabold text-slate-900">Estructura SQL Lista para Producción</h3>
                                <p class="text-xs text-slate-500">Copie o descargue el archivo .sql para implementarlo en su servidor MySQL / MariaDB</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="copySqlScript()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition">
                                    <i class="fa-solid fa-copy mr-1"></i>Copiar SQL
                                </button>
                                <button onclick="downloadSqlScript()" class="px-4 py-2 bg-brand hover:bg-brand-light text-white text-xs font-semibold rounded-xl transition">
                                    <i class="fa-solid fa-download mr-1"></i>Descargar .SQL
                                </button>
                            </div>
                        </div>
                        <textarea id="sql-script-textarea" readonly rows="16" class="w-full p-4 text-xs font-mono bg-slate-900 text-emerald-400 rounded-2xl border border-slate-700 focus:outline-none">${escapeHtml(sqlText)}</textarea>
                    </div>
                </div>
            `;
        }

        function copyEnvFile() {
            const ta = document.getElementById('env-file-textarea');
            ta.select();
            document.execCommand('copy');
            showToast('Contenido del archivo .env copiado al portapapeles.');
        }

        function downloadEnvFile() {
            const blob = new Blob([getEnvFileContent(false) + '\n'], { type: 'text/plain;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '.env';
            link.click();
            showToast('Archivo .env descargado.');
        }

        function copySqlScript() {
            const ta = document.getElementById('sql-script-textarea');
            ta.select();
            document.execCommand('copy');
            showToast('Script SQL copiado al portapapeles.');
        }

        function downloadSqlScript() {
            const blob = new Blob([getSqlDatabaseScript()], { type: 'application/sql;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'upfr_gestion_ti.sql';
            link.click();
            showToast('Archivo upfr_gestion_ti.sql descargado.');
        }

        async function downloadProjectZip() {
            if (typeof JSZip === 'undefined') {
                showToast('No se pudo cargar la librería JSZip.', 'error');
                return;
            }
            try {
                const zip = new JSZip();
                const root = zip.folder('gestion-ti-upfr');
                const cssFolder = root.folder('css');
                const jsFolder = root.folder('js');
                const dbFolder = root.folder('database');

                // 1. Extraer hoja de estilos a css/styles.css
                const styleEl = document.getElementById('custom-app-styles');
                const cssContent = styleEl ? styleEl.textContent.trim() : '';
                cssFolder.file('styles.css', cssContent + '\n');

                // 2. Extraer lógica JS a js/app.js
                const scriptEl = document.getElementById('main-app-script');
                const jsContent = scriptEl ? scriptEl.textContent.trim() : '';
                jsFolder.file('app.js', jsContent + '\n');

                // 3. Construir index.html limpio apuntando a css/styles.css y js/app.js
                const docClone = document.documentElement.cloneNode(true);
                const cloneStyle = docClone.querySelector('#custom-app-styles');
                if (cloneStyle) {
                    const linkTag = document.createElement('link');
                    linkTag.setAttribute('rel', 'stylesheet');
                    linkTag.setAttribute('href', 'css/styles.css');
                    cloneStyle.replaceWith(linkTag);
                }
                const cloneScript = docClone.querySelector('#main-app-script');
                if (cloneScript) {
                    const extScript = document.createElement('script');
                    extScript.setAttribute('src', 'js/app.js');
                    cloneScript.replaceWith(extScript);
                }
                const cleanHtml = '<!DOCTYPE html>\n' + docClone.outerHTML;
                root.file('index.html', cleanHtml);

                // 4. Agregar Script SQL en database/upfr_gestion_ti.sql
                dbFolder.file('upfr_gestion_ti.sql', getSqlDatabaseScript() + '\n');

                // 5. Agregar archivos de configuración para Git (.env, .env.example y .gitignore)
                root.file('.env', getEnvFileContent(false) + '\n');
                root.file('.env.example', getEnvFileContent(true) + '\n');
                root.file('.gitignore', getGitignoreContent() + '\n');

                // 6. Agregar README.md explicativo para el técnico y Git
                const readmeText = [
                    '# Sistema de Gestión de Tickets y Requerimientos para Eventos (OTI - UPFR)',
                    '',
                    '## Estructura del Proyecto para Git',
                    '',
                    '    gestion-ti-upfr/',
                    '    ├── .env                        # Variables de entorno locales / producción',
                    '    ├── .env.example                # Plantilla de entorno para el repositorio Git',
                    '    ├── .gitignore                  # Exclusión de archivos sensibles (.env)',
                    '    ├── index.html                  # Estructura HTML principal e interfaces',
                    '    ├── css/',
                    '    │   └── styles.css              # Estilos institucionales (#910048) y animaciones',
                    '    ├── js/',
                    '    │   └── app.js                  # Lógica de tickets, eventos, Meet, tintas y reportes',
                    '    └── database/',
                    '        └── upfr_gestion_ti.sql     # Script de creación de tablas MySQL / MariaDB',
                    '',
                    '## Credenciales Iniciales',
                    '- Administrador: usuario admin | contraseña 123',
                    '- Técnico: usuario tecnico | contraseña 123'
                ].join('\n');
                root.file('README.md', readmeText);

                const content = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = 'gestion-ti-upfr.zip';
                link.click();
                showToast('Proyecto descargado con carpetas y archivo .env (gestion-ti-upfr.zip).');
            } catch (err) {
                console.error(err);
                showToast('Error al generar el archivo ZIP.', 'error');
            }
        }

        /* ==========================================================================
           17. GESTIÓN DE FOTO DE PERFIL (AVATAR MODAL)
           ========================================================================== */
        function openProfilePhotoModal(userId) {
            const target = appState.users.find(u => u.id === userId);
            if (!target) return;
            avatarTargetUserId = target.id;
            selectedAvatarDataUrl = target.avatar || getAvatarUrl(target.name);

            document.getElementById('avatar-target-label').textContent = `Usuario: ${target.name}`;
            document.getElementById('avatar-preview-img').src = selectedAvatarDataUrl;

            const colors = ['910048', '141829', '2563eb', '059669'];
            document.getElementById('preset-avatars-grid').innerHTML = colors.map(hex => {
                const url = getAvatarUrl(target.name, hex);
                return `
                    <button type="button" onclick="selectPresetAvatar('${url}')" class="p-1 rounded-xl border border-slate-200 hover:border-brand flex justify-center">
                        <img src="${url}" alt="Avatar" class="w-12 h-12 rounded-full">
                    </button>
                `;
            }).join('');

            openModal('avatar-modal');
        }

        function selectPresetAvatar(url) {
            selectedAvatarDataUrl = url;
            document.getElementById('avatar-preview-img').src = url;
        }

        function handleAvatarFileUpload(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                selectedAvatarDataUrl = ev.target.result;
                document.getElementById('avatar-preview-img').src = selectedAvatarDataUrl;
            };
            reader.readAsDataURL(file);
        }

        function saveSelectedAvatar() {
            const target = appState.users.find(u => u.id === avatarTargetUserId);
            if (!target) return;
            target.avatar = selectedAvatarDataUrl;
            saveState();
            if (currentUser && currentUser.id === target.id) {
                currentUser = target;
                updateSidebarProfile();
            }
            if (activeView === 'maintenance') renderMaintenanceView();
            closeModal('avatar-modal');
            showToast('Foto de perfil actualizada.');
        }

        /* ==========================================================================
           18. INICIALIZACIÓN AL CARGAR LA PÁGINA
           ========================================================================== */
        window.addEventListener('DOMContentLoaded', () => {
            appState = loadState();
        });
