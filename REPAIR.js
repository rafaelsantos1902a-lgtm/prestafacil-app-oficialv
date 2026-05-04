import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'if (!user) {';
const endMarker = '{/* Modal Editar */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found");
  process.exit(1);
}

const loginAndMain = `  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 selection:bg-brand-primary/30">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-surface rounded-2xl p-10 w-full max-w-md border border-brand-border shadow-2xl"
        >
          <div className="bg-brand-secondary w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-border">
            <ShieldCheck className="w-10 h-10 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-black text-center text-brand-text mb-2 uppercase tracking-tight">PRESTAFÁCIL</h1>
          <p className="text-center text-brand-text/40 font-bold text-[10px] uppercase tracking-widest mb-8">Gestión de Cartera & Cobros</p>
          
          <form onSubmit={loginWithEmail} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Correo Electrónico</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border p-4 rounded-xl font-bold text-brand-text focus:border-brand-primary outline-none transition-all"
                placeholder="admin@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Contraseña</label>
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border p-4 rounded-xl font-bold text-brand-text focus:border-brand-primary outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-brand-primary text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-[0.98] transition-all"
            >
              {authMode === 'login' ? 'INICIAR SESIÓN' : 'REGISTRARSE'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-border"></div></div>
            <div className="relative flex justify-center text-[8px] font-black uppercase text-brand-text/30 bg-brand-surface px-2">O continuar con</div>
          </div>

          <button 
            type="button"
            onClick={loginWithGoogle}
            className="w-full bg-white text-slate-900 py-4 rounded-xl font-black flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 active:scale-95 transition-all text-[9px] border border-slate-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.94 0 3.51.66 4.87 1.96l3.62-3.62C18.23 1.33 15.39 0 12 0 7.31 0 3.25 2.69 1.25 6.63l4.21 3.27c.99-2.95 3.75-5.13 6.54-5.13z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.8-.07-1.57-.2-2.32H12v4.39h6.44c-.28 1.48-1.12 2.74-2.38 3.58l3.69 2.87c2.16-1.99 3.74-4.92 3.74-8.52z"/>
              <path fill="#FBBC05" d="M5.46 12c0-.69.12-1.36.33-1.99l-4.22-3.27C.54 8.03 0 9.96 0 12c0 2.04.54 3.97 1.57 5.26l4.22-3.27c-.21-.63-.33-1.3-.33-1.99z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.69-2.87c-1.1.74-2.51 1.17-4.26 1.17-3.28 0-6.06-2.22-7.05-5.21l-4.21 3.27C3.25 21.31 7.31 24 12 24z"/>
            </svg>
            GOOGLE ACCOUNT
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 selection:bg-brand-primary/30 text-brand-text">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-surface rounded-2xl p-10 w-full max-w-md border border-brand-border shadow-2xl text-center"
        >
          <div className="bg-brand-secondary w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-border">
            <Lock className="w-10 h-10 text-brand-primary" />
          </div>
          <h2 className="text-xl font-black mb-1 uppercase tracking-tight">Acceso Privado</h2>
          <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-[0.2em] mb-8">Ingresa tu código PIN</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="password" 
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              maxLength={4}
              placeholder="••••"
              className="w-full text-center text-4xl font-black tracking-[1em] bg-brand-bg border border-brand-border p-6 rounded-2xl focus:border-brand-primary outline-none transition-all shadow-inner"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-[0.98] transition-all"
            >
              DESBLOQUEAR SISTEMA
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg font-sans text-brand-text overflow-x-hidden">
      <Toaster position="top-right" richColors />
      
      <nav className="bg-brand-surface border-b border-brand-border px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="bg-brand-bg border border-brand-border p-2 rounded-xl"><PiggyBank className="w-5 h-5 text-brand-primary" /></div>
          <div>
            <span className="text-lg font-black tracking-tight text-brand-text">PRESTAFÁCIL</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-brand-secondary rounded-lg">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={handleLogout} className="p-2 bg-brand-red/10 text-brand-red rounded-lg"><LogOut className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
             <p className="text-[10px] font-black text-brand-text/30 uppercase mb-1">Caja Disponible</p>
             <h3 className="text-2xl font-black text-brand-text font-mono">{formatMoney(totals.caja)}</h3>
          </div>
          <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
             <p className="text-[10px] font-black text-brand-text/30 uppercase mb-1">Capital en Calle</p>
             <h3 className="text-2xl font-black text-brand-text font-mono">{formatMoney(totals.calle)}</h3>
          </div>
          <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
             <p className="text-[10px] font-black text-brand-text/30 uppercase mb-1">Utilidad Real</p>
             <h3 className="text-2xl font-black text-brand-green font-mono">{formatMoney(totals.ganancia)}</h3>
          </div>
          <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border border-l-brand-primary border-l-4 shadow-sm cursor-pointer hover:bg-brand-bg transition-all" onClick={() => setShowCashModal(true)}>
             <p className="text-[10px] font-black text-brand-primary uppercase mb-1 flex items-center gap-2"><Wallet className="w-3 h-3" /> Gestión de Caja</p>
             <h3 className="text-sm font-black text-brand-text uppercase">Historial & Ajustes</h3>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/30" />
            <input 
              type="text" 
              placeholder="Buscar cliente o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border pl-12 pr-4 py-4 rounded-xl font-bold text-brand-text outline-none focus:border-brand-primary shadow-sm"
            />
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <div className="bg-brand-surface border border-brand-border p-1 rounded-xl flex items-center shadow-sm w-full lg:w-auto">
               <button onClick={() => setActiveTab('activos')} className={
                 \`flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all \${
                   activeTab === 'activos' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'
                 }\`
               }>Activos</button>
               <button onClick={() => setActiveTab('historial')} className={
                 \`flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all \${
                   activeTab === 'historial' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'
                 }\`
               }>Historial</button>
            </div>
            <button onClick={() => setShowNewLoanModal(true)} className="bg-brand-primary text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> Nuevo Préstamo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredLoans.map((l) => (
              <motion.div 
                key={l.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-brand-surface rounded-2xl p-6 border border-brand-border shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-brand-text uppercase tracking-tight truncate max-w-[200px]">{l.client}</h3>
                    <p className="text-[9px] font-bold text-brand-text/30 uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> {l.date}</p>
                  </div>
                  <div className={\`px-3 py-1 rounded-full text-[8px] font-black uppercase \${l.status === 'ACTIVO' ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' : 'bg-brand-red/10 text-brand-red border border-brand-red/20'}\`}>
                    {l.status}
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                   <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] font-black text-brand-text/30 uppercase">Saldo Pendiente</p>
                        <p className="text-2xl font-black text-brand-text font-mono">{formatMoney(l.remaining)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-brand-text/30 uppercase">Cuota</p>
                        <p className="text-sm font-black text-brand-primary">{formatMoney(l.debt / l.installments)}</p>
                      </div>
                   </div>

                   <div className="relative h-2 bg-brand-bg rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: \\\`\${l.progress}%\\\` }}
                        className="absolute top-0 left-0 h-full bg-brand-primary" 
                      />
                   </div>
                   <p className="text-right text-[8px] font-black text-brand-text/20 uppercase tracking-widest">{l.progress}% Pagado</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <button 
                    onClick={() => { setCurrentLoan(l); setShowPaymentModal(true); } }
                    className="bg-brand-primary text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg shadow-brand-primary/20 hover:brightness-110 transition-all"
                   >RECAUDAR</button>
                   <button 
                    onClick={() => { setCurrentLoan(l); setShowScheduleModal(true); } }
                    className="bg-brand-secondary text-brand-text/60 py-3 rounded-xl font-black text-[9px] border border-brand-border uppercase hover:bg-brand-secondary/80 transition-all"
                   >PLAN DE PAGOS</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Footer info/stats links */}
        <div className="mt-12 flex flex-wrap justify-center gap-6">
           <button onClick={() => setShowGrowthModal(true)} className="flex items-center gap-2 text-[10px] font-black text-brand-text/30 uppercase hover:text-brand-primary transition-colors">
              <TrendingUp className="w-4 h-4" /> Estadísticas de Crecimiento
           </button>
           <button onClick={() => setShowMigrationModal(true)} className="flex items-center gap-2 text-[10px] font-black text-brand-text/30 uppercase hover:text-brand-red transition-colors">
              <Database className="w-4 h-4" /> Respaldo / Migración
           </button>
        </div>
      </main>
`;

const newContent = content.substring(0, startIndex) + loginAndMain + content.substring(endIndex);
fs.writeFileSync(filePath, newContent);
console.log("App.tsx repaired successfully");
