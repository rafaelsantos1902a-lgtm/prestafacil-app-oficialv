/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Wallet, TrendingUp, PiggyBank, Search, Plus, 
  CheckCircle2, Calendar, FileText, Printer, X, 
  MessageCircle, Edit, Trash2, AlertCircle, 
  History, ArrowDownRight, ArrowUpRight, Cloud, ListChecks, 
  Phone, Home, Briefcase, Check, Lock, Trash, Upload, Download,
  MapPin, User, Moon, Sun, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, 
  deleteDoc, writeBatch, query, orderBy, getDocFromServer 
} from 'firebase/firestore';

// 1. CONFIGURACIÓN FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCBKn0LYIjkSc27lBJ6nzm-V4h2SdI7uz4",
  authDomain: "prestafacil-4e73a.firebaseapp.com",
  projectId: "prestafacil-4e73a",
  storageBucket: "prestafacil-4e73a.firebasestorage.app",
  messagingSenderId: "48360971872",
  appId: "1:48360971872:web:ccbc86eab3deef1e3e6d05"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_DATA_PREFIX = 'prestafacil-v1';
const PIN_ACCESO = "1234";

interface Loan {
  id: string;
  client: string;
  phone: string;
  idNumber?: string;
  address?: string;
  workplace?: string;
  date: string;
  progress: number;
  debt: number;
  remaining: number;
  principal: number;
  status: 'ACTIVO' | 'PAGADO' | 'RENOVADO';
  freqDays: number;
  installments: number;
  interestRate?: number;
  fixedQuota?: number;
}

interface Transaction {
  id: string;
  type: 'INYECCION' | 'RETIRO';
  amount: number;
  concept: string;
  date: string;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'activos' | 'historial'>('activos');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales
  const [currentLoan, setCurrentLoan] = useState<Loan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  
  // Formularios
  const [migrationText, setMigrationText] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', idNumber: '', address: '', workplace: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: '15'
  });
  const [editForm, setEditForm] = useState({ client: '', phone: '', idNumber: '', address: '', workplace: '', debt: '', remaining: '', status: '' });
  const [renewForm, setRenewForm] = useState({ capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: '' });
  const [cashForm, setCashForm] = useState({ type: 'INYECCION' as 'INYECCION' | 'RETIRO', amount: '', concept: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setAuthError(null);
      } 
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login error:", error);
      setAuthError("Error al iniciar sesión: " + error.message);
    }
  };

  const loginAnonymously = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      setAuthError("Error al iniciar sesión: " + error.message);
    }
  };

  const handleLogout = async () => {
    if (confirm("¿Cerrar sesión?")) {
      await signOut(auth);
    }
  };

  useEffect(() => {
    if (!user || !isAuthenticated) return;
    
    const loansRef = collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans');
    const unsubLoans = onSnapshot(loansRef, (s) => {
      setLoans(s.docs.map(d => ({ id: d.id, ...d.data() } as Loan)));
    }, () => setAuthError("Error al sincronizar préstamos."));

    const transRef = collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions');
    const unsubTrans = onSnapshot(query(transRef, orderBy('date', 'desc')), (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, () => setAuthError("Error al sincronizar transacciones."));

    return () => { unsubLoans(); unsubTrans(); };
  }, [user, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === PIN_ACCESO) { 
      setIsAuthenticated(true); 
      setPinInput('');
    } else { 
      setSystemMessage("❌ PIN incorrecto"); 
      setPinInput(''); 
    }
  };

  // Cálculos Globales
  const totals = useMemo(() => {
    const caja = transactions.reduce((t, tr) => tr.type === 'RETIRO' ? t - tr.amount : t + tr.amount, 0);
    const calle = loans.reduce((t, l) => l.status === 'ACTIVO' ? t + l.remaining : t, 0);
    const ganancia = loans.reduce((t, l) => t + (Number(l.debt || 0) - Number(l.principal || 0)), 0);
    const recaudado = transactions.reduce((t, tr) => {
      const concept = tr.concept.toLowerCase();
      if (concept.includes('abono') || concept.includes('cobro') || concept.includes('pago')) {
        return t + tr.amount;
      }
      return t;
    }, 0);
    return { caja, calle, ganancia, recaudado };
  }, [transactions, loans]);

  const uniqueClients = useMemo(() => {
    const seen = new Set();
    return loans.filter(l => {
      const duplicate = seen.has(l.client);
      seen.add(l.client);
      return !duplicate;
    });
  }, [loans]);

  const formatMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  // Sistema de Notificaciones
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  const sendPaymentAlert = (client: string, amount: number) => {
    const title = '💰 Pago Recibido';
    const body = `Se ha registrado un abono de ${formatMoney(amount)} de ${client}.`;
    
    // Alerta Visual (Toas)
    toast.success(title, {
      description: body,
      duration: 5000,
    });

    // Alerta Push (Nativa)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico' // Opcional
      });
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const checkPaymentDeadlines = () => {
    if (loans.length === 0) return;
    
    loans.forEach(loan => {
      if (loan.status !== 'ACTIVO') return;
      
      const schedule = calculateSchedule(loan);
      const pendingPayments = schedule.filter(s => s.status === 'PENDIENTE');
      
      if (pendingPayments.length > 0) {
        const nextPayment = pendingPayments[0];
        const dueDate = new Date(nextPayment.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - dueDate.getTime();
        const diffDaysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffDaysToWait = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDaysOverdue > 0) {
          // MORA
          const moraRate = 0.05; // 5% daily as per contract
          const moraAmount = nextPayment.amount * moraRate * diffDaysOverdue;
          const totalWithMora = nextPayment.amount + moraAmount;
          
          const title = `⚠️ MORA: ${loan.client}`;
          const body = `El pago de ${formatMoney(nextPayment.amount)} venció hace ${diffDaysOverdue} días. Mora acumulada: ${formatMoney(moraAmount)}. Total: ${formatMoney(totalWithMora)}`;
          
          toast.error(title, {
            description: body,
            action: {
              label: "WhatsApp",
              onClick: () => {
                const text = `⚠️ *RECORDATORIO DE MORA - PRESTAFÁCIL*%0A👤 *Cliente:* ${loan.client}%0A🚨 *Estado:* Préstamo en MORA%0A💵 *Monto Vencido:* ${formatMoney(nextPayment.amount)}%0A📅 *Fecha Vencimiento:* ${nextPayment.date}%0A⚠️ _Por favor regularice su situación para evitar incrementos._`;
                window.open(`https://wa.me/1${loan.phone.replace(/\D/g, '')}?text=${text}`, '_blank');
              }
            }
          });
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
          }
        } else if (diffDaysToWait === 3 || diffDaysToWait === 1) {
          // RECORDATORIO
          const title = `📅 RECORDATORIO: ${loan.client}`;
          const body = `Se aproxima un pago de ${formatMoney(nextPayment.amount)} en ${diffDaysToWait} días (${nextPayment.date}).`;
          
          toast.warning(title, {
            description: body,
            action: {
              label: "Recordar",
              onClick: () => {
                const text = `🔔 *RECORDATORIO DE PAGO - PRESTAFÁCIL*%0A👤 *Cliente:* ${loan.client}%0A📅 *Fecha de Pago:* ${nextPayment.date}%0A💵 *Monto:* ${formatMoney(nextPayment.amount)}%0A✅ _Recuerde pagar a tiempo para mantener su buen historial._`;
                window.open(`https://wa.me/1${loan.phone.replace(/\D/g, '')}?text=${text}`, '_blank');
              }
            }
          });
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
          }
        }
      }
    });
  };

  useEffect(() => {
    if (loans.length > 0) {
      checkPaymentDeadlines();
    }
  }, [loans]);
  
  const handleDownloadReceiptPDF = () => {
    if (!currentLoan) return;
    setIsSubmitting(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 120] // Smaller ticket
      });

      const client = currentLoan.client;
      const amountNum = Number(paymentAmount);
      const amount = formatMoney(amountNum);
      
      // Calculate totals for this client
      const clientLoans = loans.filter(l => l.client === client && l.status === 'ACTIVO');
      const totalDebt = clientLoans.reduce((sum, l) => sum + l.debt, 0);
      const totalRemaining = clientLoans.reduce((sum, l) => sum + l.remaining, 0);

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 80, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('PRESTAFACIL', 40, 12, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('RECIBO DE PAGO', 40, 16, { align: 'center' });

      // Main Amount
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(10, 22, 60, 15, 3, 3, 'F');
      doc.setFontSize(6);
      doc.text('PAGO DE HOY', 40, 26, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(amount, 40, 33, { align: 'center' });

      // Details
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      let y = 45;
      doc.text('CLIENTE:', 10, y);
      doc.text(client.toUpperCase(), 70, y, { align: 'right' });
      
      y += 8;
      doc.text('FECHA:', 10, y);
      doc.text(new Date().toLocaleDateString(), 70, y, { align: 'right' });

      y += 12;
      doc.text('PAGO RECIBIDO:', 10, y);
      doc.text(amount, 70, y, { align: 'right' });

      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('SALDO PENDIENTE:', 10, y);
      doc.setTextColor(239, 68, 68);
      doc.text(formatMoney(totalRemaining), 70, y, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Gracias por su confianza.', 40, 105, { align: 'center' });
      doc.text('www.prestafacil.app', 40, 110, { align: 'center' });

      doc.save(`Recibo_${client.replace(/\s+/g, '_')}.pdf`);
      toast.success("Recibo generado");
    } catch (e) {
      console.error('PDF error:', e);
      toast.error("Error al generar PDF");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadSchedulePDF = () => {
    if (!currentLoan) return;
    setIsSubmitting(true);
    try {
      const schedule = calculateSchedule(currentLoan);
      const totalRows = schedule.length;
      const rowHeight = 8;
      const headerHeight = 70;
      const footerHeight = 20;
      const dynamicHeight = headerHeight + (totalRows * rowHeight) + footerHeight;

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, Math.max(150, dynamicHeight)] // Long ticket format for WhatsApp/Mobile
      });

      const client = currentLoan.client;

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 80, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('PRESTAFACIL', 40, 15, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('PLAN DE PAGOS OFICIAL', 40, 20, { align: 'center' });

      doc.setFontSize(7);
      doc.text(`CLIENTE: ${client.toUpperCase()}`, 10, 32);
      doc.text(`FECHA INICIO: ${currentLoan.date}`, 10, 37);
      doc.text(`MONTO ADEUDADO: ${formatMoney(currentLoan.debt)}`, 10, 42);
      doc.text(`SALDO ACTUAL: ${formatMoney(currentLoan.remaining)}`, 10, 47);

      doc.setDrawColor(226, 232, 240);
      doc.line(10, 51, 70, 51);

      // Table Header
      doc.setFont('helvetica', 'bold');
      doc.text('N.', 10, 57);
      doc.text('FECHA', 20, 57);
      doc.text('CUOTA', 45, 57);
      doc.text('ESTADO', 62, 57);
      doc.setFont('helvetica', 'normal');

      schedule.forEach((s, i) => {
        const y = 57 + 8 + (i * 8);
        doc.text(String(s.num), 10, y);
        doc.text(s.date.split(' de ')[0] + ' ' + s.date.split(' de ')[1], 20, y); // Short date
        doc.text(formatMoney(s.amount), 45, y);
        
        if (s.status === 'PAGADO') {
          doc.setTextColor(16, 185, 129);
        } else if (s.status === 'MORA') {
          doc.setTextColor(239, 68, 68);
        } else {
          doc.setTextColor(37, 99, 235);
        }
        doc.text(s.status, 62, y);
        doc.setTextColor(0, 0, 0);
      });

      const finalY = 62 + 8 + (totalRows * 8) + 10;
      doc.setFontSize(6);
      doc.text('Este documento es un compromiso de pago.', 40, finalY, { align: 'center' });
      doc.text('www.prestafacil.app', 40, finalY + 4, { align: 'center' });

      doc.save(`Plan_${client.replace(/\s+/g, '_')}.pdf`);
      toast.success("PDF generado (Optimizado para WhatsApp)");
    } catch (e) {
      console.error('PDF error:', e);
      toast.error("Error al generar PDF");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenewLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    setFormError(null);

    const cap = parseFloat(renewForm.capital);
    const inst = parseInt(renewForm.installments);
    
    if (isNaN(cap) || cap <= 0) return setFormError("El capital debe ser mayor a 0.");
    if (isNaN(inst) || inst <= 0) return setFormError("Cuotas inválidas.");
    if (inst > 5000) return setFormError("Máximo 5000 cuotas permitidas.");

    const amountToSettle = currentLoan.remaining;
    const netToDeliver = cap - amountToSettle;

    if (netToDeliver > totals.caja) {
      return setFormError(`Caja insuficiente. Necesita entregar ${formatMoney(netToDeliver)} pero solo hay ${formatMoney(totals.caja)}.`);
    }

    let total = 0;
    if (renewForm.calcMethod === 'fija') {
      const fixed = parseFloat(renewForm.fixedQuota);
      if (isNaN(fixed) || fixed <= 0) return setFormError("Sueldo de cuota inválido.");
      total = fixed * inst;
    } else {
      const rate = parseFloat(renewForm.interestRate);
      if (isNaN(rate) || rate < 0) return setFormError("Tasa inválida.");
      total = cap + (cap * (rate / 100));
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      // 1. Mark current as RENEWED
      const oldLoanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', currentLoan.id);
      batch.update(oldLoanRef, { status: 'RENOVADO', remaining: 0 });

      // 2. Create NEW loan
      const newLoanRef = doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans'));
      const loanData = { 
        client: currentLoan.client, 
        phone: currentLoan.phone, 
        idNumber: currentLoan.idNumber || '', 
        address: currentLoan.address || '', 
        workplace: currentLoan.workplace || '',
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, 
        debt: Number(total.toFixed(2)), 
        remaining: Number(total.toFixed(2)), 
        principal: cap, 
        status: 'ACTIVO' as const, 
        freqDays: parseInt(newLoanForm.freqDays), // Reuse freq from main form or add to renew
        installments: inst,
        interestRate: renewForm.calcMethod === 'interes' ? parseFloat(renewForm.interestRate) : null,
        fixedQuota: renewForm.calcMethod === 'fija' ? parseFloat(renewForm.fixedQuota) : null
      };
      batch.set(newLoanRef, loanData);

      // 3. Register transaction (net out)
      if (netToDeliver > 0) {
        const transRef = doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'));
        batch.set(transRef, { 
          type: 'RETIRO', 
          amount: netToDeliver, 
          concept: `Renovación - ${currentLoan.client} (Nuevo: ${formatMoney(cap)} - Saldo Ant: ${formatMoney(amountToSettle)})`, 
          date: new Date().toISOString() 
        });
      } else if (netToDeliver < 0) {
        // This case is unlikely (borrowing less than remaining), but handle just in case
        const transRef = doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'));
        batch.set(transRef, { 
          type: 'INYECCION', 
          amount: Math.abs(netToDeliver), 
          concept: `Renovación con Saldo Positivo - ${currentLoan.client}`, 
          date: new Date().toISOString() 
        });
      }

      await batch.commit();
      setShowRenewModal(false);
      setSystemMessage(`✅ Préstamo renovado con éxito. Se entregó ${formatMoney(Math.max(0, netToDeliver))} neto.`);
      setRenewForm({ capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: '' });
    } catch (err) {
      console.error(err);
      setFormError("Error al procesar renovación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const printElement = (elementId: string) => {
    const content = document.getElementById(elementId);
    if (!content) return;
    
    // Create a hidden iframe for printing to avoid popup blockers and handle styles better
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.write(`
      <html>
        <head>
          <title>Imprimir</title>
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
             body { 
               font-family: 'Inter', sans-serif; 
               padding: 40px; 
               background: white;
               color: black;
               -webkit-print-color-adjust: exact;
             }
             /* Ensure no oklch colors are used in the print view by providing fallback colors or simple styles */
             .text-center { text-align: center; }
             .font-black { font-weight: 900; }
             .font-bold { font-weight: 700; }
             .uppercase { text-transform: uppercase; }
             .tracking-tighter { letter-spacing: -0.05em; }
             .text-2xl { font-size: 1.5rem; }
             .text-sm { font-size: 0.875rem; }
             .mb-1 { margin-bottom: 0.25rem; }
             .mb-6 { margin-bottom: 1.5rem; }
             .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
             .underline { text-decoration: underline; }
             .border-b-2 { border-bottom-width: 2px; }
             .border-doc-primary { border-color: #0f172a; }
             .bg-doc-bg { background-color: #f8fafc; }
             .text-doc-secondary { color: #64748b; }
             .text-doc-primary { color: #0f172a; }
             .text-doc-accent { color: #dc2626; }
             .text-slate-900 { color: #0f172a; }
             .text-red-600 { color: #dc2626; }
             .p-6 { padding: 1.5rem; }
             .border-l-4 { border-left-width: 4px; }
             .italic { font-style: italic; }
             .space-y-8 > * + * { margin-top: 2rem; }
             .grid { display: grid; }
             .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
             .gap-20 { gap: 5rem; }
             .pt-20 { padding-top: 5rem; }
             .pt-3 { padding-top: 0.75rem; }
             .text-slate-500 { color: #64748b; }
             .text-slate-400 { color: #64748b; }
             .text-brand-text { color: #0d0d0d; }
             .text-brand-primary { color: #007acc; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(() => {
                window.frameElement.remove();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const handleClientNameChange = (name: string) => {
    const existingClient = uniqueClients.find(c => c.client.toLowerCase() === name.toLowerCase());
    setNewLoanForm(prev => ({ 
      ...prev, 
      client: name, 
      phone: existingClient ? (existingClient.phone || '') : prev.phone,
      idNumber: existingClient ? (existingClient.idNumber || '') : prev.idNumber,
      address: existingClient ? (existingClient.address || '') : prev.address,
      workplace: existingClient ? (existingClient.workplace || '') : prev.workplace
    }));
  };

  const calculateSchedule = (loan: Loan) => {
    if (!loan) return [];
    const schedule = [];
    
    // Parse loan starting date correctly
    let startDate = new Date();
    if (loan.date) {
      const parts = loan.date.split('/');
      if (parts.length === 3) {
        // dd/mm/yyyy -> mm/dd/yyyy for Date constructor
        startDate = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      }
    }
    
    const freq = Number(loan.freqDays || 15);
    const totalInst = Math.max(1, Number(loan.installments || 1));
    const quotaAmount = (Number(loan.debt || 0) / totalInst);
    
    let totalPaid = Number(loan.debt || 0) - Number(loan.remaining || 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= totalInst; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (freq * i));
      dueDate.setHours(0, 0, 0, 0);
      
      let isPaid = false;
      if (totalPaid >= (quotaAmount - 0.01)) {
        isPaid = true;
        totalPaid -= quotaAmount;
      } else {
        totalPaid = 0;
      }

      // Late Fee (Mora) calculation
      let moraAmount = 0;
      let status = isPaid ? 'PAGADO' : 'PENDIENTE';
      
      if (!isPaid && today > dueDate) {
        const diffTimeOverdue = Math.abs(today.getTime() - dueDate.getTime());
        const diffDaysOverdue = Math.floor(diffTimeOverdue / (1000 * 60 * 60 * 24));
        if (diffDaysOverdue > 0) {
          const moraRateDaily = 0.05; // 5% daily as per contract
          moraAmount = quotaAmount * moraRateDaily * diffDaysOverdue;
          status = 'MORA';
        }
      }

      schedule.push({ 
        num: i, 
        date: dueDate.toLocaleDateString('es-DO', {day: '2-digit', month: 'short', year: 'numeric'}), 
        amount: quotaAmount + moraAmount,
        baseAmount: quotaAmount,
        mora: moraAmount,
        status: status
      });
    }
    return schedule;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSaveNewLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    const cap = parseFloat(newLoanForm.capital);
    const inst = parseInt(newLoanForm.installments);
    
    if (isNaN(cap) || cap <= 0) return setFormError("El capital debe ser mayor a 0.");
    if (isNaN(inst) || inst <= 0) return setFormError("La cantidad de cuotas debe ser válida.");
    if (inst > 5000) return setFormError("Máximo 5000 cuotas permitidas.");

    let total = 0;
    if (newLoanForm.calcMethod === 'fija') {
      const fixed = parseFloat(newLoanForm.fixedQuota);
      if (isNaN(fixed) || fixed <= 0) return setFormError("Ingrese un monto de cuota válido.");
      total = fixed * inst;
    } else {
      const rate = parseFloat(newLoanForm.interestRate);
      if (isNaN(rate) || rate < 0) return setFormError("Ingrese una tasa de interés válida.");
      total = cap + (cap * (rate / 100));
    }

    if (cap > totals.caja) {
      return setFormError(`Fondos insuficientes en caja. Disponible: ${formatMoney(totals.caja)}. Vaya a 'Gestión de Caja' e inyecte capital primero.`);
    }

    setIsSubmitting(true);
    try {
      const loanData = { 
        client: newLoanForm.client.trim(), 
        phone: newLoanForm.phone.trim(), 
        idNumber: newLoanForm.idNumber?.trim() || '', 
        address: newLoanForm.address?.trim() || '', 
        workplace: newLoanForm.workplace?.trim() || '',
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, 
        debt: Number(total.toFixed(2)), 
        remaining: Number(total.toFixed(2)), 
        principal: cap, 
        status: 'ACTIVO' as const, 
        freqDays: parseInt(newLoanForm.freqDays), 
        installments: inst,
        interestRate: newLoanForm.calcMethod === 'interes' ? parseFloat(newLoanForm.interestRate) : null,
        fixedQuota: newLoanForm.calcMethod === 'fija' ? parseFloat(newLoanForm.fixedQuota) : null
      };

      await addDoc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans'), loanData);
      await addDoc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'), { 
        type: 'RETIRO', 
        amount: cap, 
        concept: `Desembolso Préstamo - ${newLoanForm.client}`, 
        date: new Date().toISOString() 
      });

      closeAllModals();
      setNewLoanForm({ client: '', phone: '', idNumber: '', address: '', workplace: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: '15' });
      setSystemMessage("✅ Préstamo creado y capital descontado de caja.");
    } catch (err) { 
      console.error(err);
      setFormError("Error al guardar en la base de datos."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    setFormError(null);
    const monto = parseFloat(paymentAmount) || 0;
    if (monto <= 0) return setFormError("Ingrese un monto válido.");

    const resta = Math.max(0, currentLoan.remaining - monto);
    
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', currentLoan.id), { 
        remaining: Number(resta.toFixed(2)), 
        progress: Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100), 
        status: resta <= 0.01 ? 'PAGADO' : 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'), { 
        type: 'INYECCION', 
        amount: monto, 
        concept: `Abono Cuota - ${currentLoan.client}`, 
        date: new Date().toISOString() 
      });

      sendPaymentAlert(currentLoan.client, monto);

      setShowPaymentModal(false); 
      setShowReceiptModal(true);
    } catch (err) { setFormError("Error al registrar pago."); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', currentLoan.id), {
        client: editForm.client.trim(),
        phone: editForm.phone.trim(),
        idNumber: editForm.idNumber.trim(),
        address: editForm.address.trim(),
        workplace: editForm.workplace.trim(),
        status: editForm.status,
        remaining: parseFloat(editForm.remaining) || 0
      });
      setShowEditModal(false);
      setSystemMessage("✅ Datos actualizados correctamente.");
    } catch (err) {
      setFormError("Error al actualizar datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLoans = loans.filter(l => l.status === 'ACTIVO');
  const pastLoans = loans.filter(l => l.status !== 'ACTIVO');
  const filteredLoans = (activeTab === 'activos' ? activeLoans : pastLoans).filter(l => 
    l.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const closeAllModals = () => {
    setShowPaymentModal(false); 
    setShowReceiptModal(false); 
    setShowNewLoanModal(false); 
    setShowCashModal(false); 
    setShowRenewModal(false); 
    setShowScheduleModal(false); 
    setShowEditModal(false); 
    setShowContractModal(false); 
    setShowMigrationModal(false);
    setCurrentLoan(null); 
    setSystemMessage(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 selection:bg-brand-primary/30">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-surface rounded-2xl p-10 w-full max-w-md border border-brand-border shadow-2xl text-center"
        >
          <div className="bg-brand-secondary w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-border">
            <ShieldCheck className="w-10 h-10 text-brand-primary" />
          </div>
          <h1 className="text-3xl font-black text-brand-text mb-2 tracking-tight uppercase">Sincronización</h1>
          <p className="text-brand-text/50 font-bold mb-8 uppercase text-[10px] tracking-widest leading-relaxed">
            Inicia sesión para ver tus préstamos en cualquier dispositivo.
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={loginWithGoogle}
              className="w-full bg-white text-slate-900 py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-lg hover:bg-slate-50 active:scale-95 transition-all text-xs border border-slate-200"
            >
              <img src="https://www.gstatic.com/firebase/explore/google.svg" className="w-4 h-4" alt="Google" />
              ACCEDER CON GOOGLE
            </button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-brand-border"></div></div>
              <div className="relative flex justify-center text-[8px] font-black uppercase text-brand-text/30 bg-brand-surface px-2">o</div>
            </div>

            <button 
              onClick={loginAnonymously}
              className="w-full bg-brand-secondary text-brand-text/70 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-secondary/80 active:scale-95 transition-all border border-brand-border"
            >
              Invitado (No sincroniza)
            </button>
          </div>

          {authError && <p className="mt-6 text-brand-red font-bold text-[10px] uppercase tracking-wide leading-relaxed">{authError}</p>}
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6 selection:bg-brand-primary/30">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-surface rounded-2xl p-10 w-full max-w-md border border-brand-border shadow-2xl text-center"
        >
          <div className="bg-brand-secondary w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-border">
            <Lock className="w-10 h-10 text-brand-primary" />
          </div>
          <h1 className="text-3xl font-black text-brand-text mb-2 tracking-tight">PrestaFácil</h1>
          <p className="text-brand-text/50 font-bold mb-8 uppercase text-[10px] tracking-widest">Sistema de Gestión</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="••••" 
              value={pinInput} 
              onChange={(e)=>setPinInput(e.target.value)} 
              className="w-full border border-brand-border p-5 rounded-xl text-center text-4xl font-black tracking-[0.3em] outline-none focus:border-brand-primary/50 bg-brand-bg text-brand-text transition-all font-mono"
              autoFocus 
            />
            <button type="submit" className="w-full bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-brand-primary/80 active:scale-95 transition-all">
              Desbloquear Acceso
            </button>
          </form>
          {systemMessage && <p className="mt-4 text-brand-red font-bold text-xs uppercase animate-pulse">{systemMessage}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text pb-20 overflow-x-hidden selection:bg-brand-primary/20">
      <Toaster position="top-right" richColors />
      <style>{`
        @media print {
          nav, aside, .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      
      {/* Header */}
      <nav className="bg-brand-surface border-b border-brand-border px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="bg-brand-bg border border-brand-border p-2 rounded-xl">
            <PiggyBank className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-brand-text">PRESTAFÁCIL</span>
            <div className="flex items-center gap-1.5 -mt-1">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${user ? 'bg-brand-green' : 'bg-brand-red'}`}></div>
              <span className="text-[9px] font-bold text-brand-text/40 uppercase">
                ESTADO: {authError ? 'ERROR' : (user ? 'CONECTADO' : 'CONECTANDO...')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="flex items-center justify-center bg-brand-secondary text-brand-text/70 border border-brand-border h-10 w-10 rounded-lg hover:bg-brand-secondary/80 transition-all shadow-sm"
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-brand-yellow" /> : <Moon className="w-5 h-5 text-brand-primary" />}
          </button>
          <button onClick={() => setShowMigrationModal(true)} className="hidden md:flex items-center gap-2 bg-brand-secondary text-brand-text/70 border border-brand-border px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-brand-secondary/80 transition-all">
            <Cloud className="w-3.5 h-3.5" /> Respaldos
          </button>
          <button 
            onClick={handleLogout} 
            className="flex items-center justify-center bg-brand-secondary text-brand-red/70 border border-brand-border h-10 w-10 rounded-lg hover:bg-brand-red/10 transition-all shadow-sm"
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 no-print">
        {authError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-brand-red p-6 rounded-2xl border border-brand-red/20 shadow-xl flex items-center gap-4"
          >
            <div className="bg-white/20 p-3 rounded-xl"><AlertCircle className="w-6 h-6 text-white" /></div>
            <div className="flex-1">
              <h3 className="text-white font-black uppercase text-sm tracking-tight">Problema de Conexión</h3>
              <p className="text-white/80 text-[11px] font-bold mt-1 uppercase tracking-wider">{authError}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-white text-brand-red px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
            >
              Reintentar
            </button>
          </motion.div>
        )}
        
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-[#0f172a] rounded-2xl p-6 relative overflow-hidden border border-white/5 shadow-xl"
          >
            <div className="flex justify-between items-center relative z-10 mb-2">
              <p className="text-white/40 uppercase tracking-widest text-[9px] font-black">Caja Disponible</p>
              <button 
                onClick={() => setShowCashModal(true)} 
                className="bg-white/10 backdrop-blur-md text-[10px] px-3 py-1 rounded-md text-white font-bold hover:bg-white/20 transition-colors border border-white/10"
              >
                GESTIONAR
              </button>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter font-mono">{formatMoney(totals.caja)}</h2>
            <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
            <div className="absolute top-0 right-0 p-4 opacity-20">
               <div className="bg-brand-primary w-2 h-2 rounded-full animate-ping"></div>
            </div>
          </motion.div>

          <div className="bg-brand-surface rounded-2xl p-6 border border-brand-border flex items-center gap-4">
            <div className="bg-brand-secondary/50 p-3 rounded-xl border border-brand-border"><TrendingUp className="w-6 h-6 text-brand-primary" /></div>
            <div>
              <p className="text-brand-text/40 text-[9px] font-black uppercase tracking-widest">En Calle</p>
              <h2 className="text-xl font-black text-brand-text font-mono">{formatMoney(totals.calle)}</h2>
            </div>
          </div>

          <div className="bg-brand-surface rounded-2xl p-6 border border-brand-border flex items-center gap-4">
            <div className="bg-brand-green/10 p-3 rounded-xl border border-brand-green/20"><div className="text-brand-green font-bold">$</div></div>
            <div>
              <p className="text-brand-text/40 text-[9px] font-black uppercase tracking-widest">Utilidad Proyectada</p>
              <h2 className="text-xl font-black text-brand-green font-mono">{formatMoney(totals.ganancia)}</h2>
            </div>
          </div>

          <div className="bg-brand-surface rounded-2xl p-6 border border-brand-border flex items-center gap-4">
            <div className="bg-brand-yellow/10 p-3 rounded-xl border border-brand-yellow/20"><ArrowDownRight className="w-6 h-6 text-brand-yellow" /></div>
            <div>
              <p className="text-brand-text/40 text-[9px] font-black uppercase tracking-widest">Cobrado Hoy</p>
              <h2 className="text-xl font-black text-brand-text font-mono">{formatMoney(totals.recaudado)}</h2>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center bg-brand-surface border border-brand-border rounded-xl px-4 py-2 w-full lg:max-w-md">
            <Search className="w-4 h-4 text-brand-text/30 mr-2" />
            <input 
              type="text" 
              placeholder="Buscar por cliente..." 
              className="bg-transparent border-none outline-none w-full text-sm font-bold text-brand-text placeholder:text-brand-text/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full lg:w-auto">
            <div className="bg-brand-surface p-1 rounded-xl border border-brand-border flex flex-1 lg:flex-none">
              <button onClick={() => setActiveTab('activos')} className={`flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'activos' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'}`}>Activos</button>
              <button onClick={() => setActiveTab('historial')} className={`flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'historial' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'}`}>Historial</button>
            </div>
            <button onClick={() => setShowNewLoanModal(true)} className="bg-brand-primary text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 hover:bg-brand-primary/80 transition-all active:scale-95 shadow-lg shadow-brand-primary/20">
              <Plus className="w-4 h-4" /> Nuevo Préstamo
            </button>
          </div>
        </div>

        {/* Loans List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredLoans.map((l) => (
              <motion.div 
                layout
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-sm hover:border-brand-primary/30 transition-all relative overflow-hidden group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-xl text-brand-text group-hover:text-brand-primary transition-colors uppercase tracking-tight truncate max-w-[200px]">
                      {l.client}
                    </h3>
                    <div className="flex items-center text-brand-text/30 text-[10px] font-bold mt-1">
                      <Calendar className="w-3 h-3 mr-1" /> DESDE {l.date}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    l.status === 'ACTIVO' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 
                    l.status === 'PAGADO' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : 
                    'bg-brand-secondary text-brand-text/30 border-brand-border'
                  }`}>
                    {l.status}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-[10px] font-black text-brand-text/30 uppercase mb-2">
                    <span>Progreso</span>
                    <span className="text-brand-text">{l.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden border border-brand-border">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${l.progress}%` }}
                      className={`h-full ${l.status === 'ACTIVO' ? 'bg-brand-primary' : 'bg-brand-green'}`}
                    />
                  </div>
                </div>

                  <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Inversión</p>
                    <p className="font-bold text-brand-text/70 font-mono">{formatMoney(l.principal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Prox. Pago</p>
                    <p className="font-bold text-brand-primary text-[10px] uppercase">{calculateSchedule(l).find(s => s.status === 'PENDIENTE')?.date || 'Finalizado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Saldo Pendiente</p>
                    <p className="text-2xl font-black text-brand-text tracking-tight font-mono">{formatMoney(l.remaining)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-5 border-t border-brand-border">
                  <button 
                    onClick={() => { setCurrentLoan(l); setPaymentAmount(''); setShowPaymentModal(true); }}
                    className="flex-1 bg-brand-primary text-white py-3 rounded-lg font-black text-[10px] uppercase hover:bg-brand-primary/80 transition-all"
                  >
                    COBRAR
                  </button>
                  <button 
                    onClick={() => { setCurrentLoan(l); setShowScheduleModal(true); }}
                    className="aspect-square bg-brand-secondary text-brand-text/50 p-3 rounded-lg hover:bg-brand-secondary/80 transition-all border border-brand-border"
                  >
                    <ListChecks className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { setCurrentLoan(l); setShowContractModal(true); }}
                    className="aspect-square bg-brand-secondary text-brand-text/50 p-3 rounded-lg hover:bg-brand-secondary/80 transition-all border border-brand-border"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { 
                      setCurrentLoan(l); 
                      setEditForm({
                        client: l.client,
                        phone: l.phone,
                        idNumber: l.idNumber || '',
                        address: l.address || '',
                        workplace: l.workplace || '',
                        debt: String(l.debt),
                        remaining: String(l.remaining),
                        status: l.status
                      });
                      setShowEditModal(true); 
                    }}
                    className="aspect-square bg-brand-secondary text-brand-text/50 p-3 rounded-lg hover:bg-brand-secondary/80 transition-all border border-brand-border"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { setCurrentLoan(l); setRenewForm({ capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: '' }); setShowRenewModal(true); }}
                    className="aspect-square bg-brand-yellow/10 text-brand-yellow p-3 rounded-lg hover:bg-brand-yellow/20 transition-all border border-brand-yellow/20"
                    title="Renovar Préstamo"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={async () => { if(confirm("¿Eliminar registro permanentemente?")) await deleteDoc(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user?.uid || '', 'loans', l.id)); }}
                    className="aspect-square bg-brand-red/10 text-brand-red p-3 rounded-lg hover:bg-brand-red/20 transition-all border border-brand-red/20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals Container */}
      <AnimatePresence>
        {/* Modal Pago */}
        {showPaymentModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-surface rounded-2xl w-full max-w-sm p-8 border border-brand-border shadow-2xl relative overflow-hidden"
            >
              <button onClick={closeAllModals} className="absolute top-6 right-6 text-brand-text-muted hover:text-brand-text">
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center mb-8">
                <h3 className="text-[10px] font-black text-brand-text-muted uppercase tracking-widest mb-2">REGISTRAR ENTRADA</h3>
                <h2 className="text-2xl font-black text-brand-text truncate px-4">{currentLoan.client}</h2>
              </div>

              <div className="bg-brand-bg rounded-2xl p-6 mb-8 border border-brand-border shadow-inner">
                <div className="flex justify-between items-center mb-1 px-4">
                   <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest">Deuda Actual</p>
                   <ArrowDownRight className="w-3 h-3 text-brand-red" />
                </div>
                <p className="text-4xl font-black text-brand-text text-center tracking-tighter font-mono">{formatMoney(currentLoan.remaining)}</p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="number" 
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-brand-bg text-brand-primary rounded-xl py-6 px-10 text-4xl font-black text-center outline-none border border-brand-border focus:border-brand-primary/50 placeholder:text-brand-text-dim font-mono shadow-inner" 
                    placeholder="0.00"
                    autoFocus
                  />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-text-muted font-black text-xl">$</div>
                </div>
                
                <button 
                  onClick={handleProcessPayment}
                  disabled={isSubmitting}
                  className={`w-full bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'hover:bg-brand-primary/80 active:scale-[0.98]'}`}
                >
                  {isSubmitting ? 'PROCESANDO...' : 'PROCESAR COBRO'}
                </button>
                {formError && (
                  <div className="bg-brand-red/10 border border-brand-red/20 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-red shrink-0" />
                    <p className="text-[10px] font-black text-brand-red uppercase tracking-tight">{formError}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Receipt Modal */}
        {showReceiptModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg z-[60] flex flex-col items-center justify-center p-4">
             <div className="w-full max-w-sm" id="receipt-content">
                <div className="text-center p-10 border border-brand-border mb-6 bg-brand-surface rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary"></div>
                  <h1 className="text-2xl font-black mb-1 text-brand-text tracking-tighter">PRESTAFÁCIL</h1>
                  <p className="text-[9px] font-bold text-brand-text-muted tracking-widest uppercase mb-10">COMPROBANTE DE PAGO</p>
                  
                  <div className="bg-brand-bg rounded-2xl p-6 border border-brand-border mb-8 shadow-inner">
                    <p className="text-[9px] font-black text-brand-text-muted uppercase tracking-widest mb-1">Total Recibido</p>
                    <h2 className="text-5xl font-black text-brand-primary tracking-tighter font-mono">{formatMoney(Number(paymentAmount))}</h2>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex justify-between border-b border-brand-border pb-2">
                      <span className="text-[10px] font-bold text-brand-text-muted uppercase">Cliente</span>
                      <span className="text-[10px] font-black uppercase text-brand-text">{currentLoan.client}</span>
                    </div>
                    <div className="flex justify-between border-b border-brand-border pb-2">
                       <span className="text-[10px] font-bold text-brand-text-muted uppercase">Pago Recibido</span>
                       <span className="text-[10px] font-black uppercase text-brand-text font-mono">{formatMoney(Number(paymentAmount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold text-brand-text-muted uppercase">Saldo Pendiente</span>
                      <span className="text-[10px] font-black uppercase text-brand-red font-mono">
                        {formatMoney(loans.filter(l => l.client === currentLoan.client && l.status === 'ACTIVO').reduce((acc, curr) => acc + curr.remaining, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 no-print">
                    <button 
                     onClick={handleDownloadReceiptPDF}
                     disabled={isSubmitting}
                     className={`w-full bg-brand-primary text-white py-5 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'active:scale-95'}`}
                    >
                      {isSubmitting ? 'GENERANDO...' : <><Download className="w-5 h-5" /> DESCARGAR RECIBO PDF</>}
                    </button>
                    <button 
                     onClick={() => {
                       const text = `🧾 *RECIBO DE PAGO - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A💵 *Monto:* ${formatMoney(Number(paymentAmount))}%0A📉 *Saldo:* ${formatMoney(currentLoan.remaining)}%0A📅 *Fecha:* ${new Date().toLocaleDateString()}%0A✅ _Gracias por su cumplimiento._`;
                       window.open(`https://wa.me/1${currentLoan.phone.replace(/\D/g, '')}?text=${text}`, '_blank');
                     }}
                     className="w-full bg-[#25D366] text-white py-4 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" /> COMPARTIR WHATSAPP
                    </button>
                   <button 
                    onClick={() => {
                      const nextPay = calculateSchedule(currentLoan).find(s => s.status === 'PENDIENTE');
                      if (!nextPay) return alert("No hay cuotas pendientes.");
                      const text = `🔔 *RECORDATORIO DE PAGO - PRESTAFÁCIL*%0A👤 *Hola ${currentLoan.client},*%0A%0A_Le recordamos su próximo compromiso de pago:_%0A%0A📅 *Fecha:* ${nextPay.date}%0A💵 *Monto:* ${formatMoney(nextPay.amount)}%0A📉 *Saldo Total:* ${formatMoney(currentLoan.remaining)}%0A%0A🤝 _Agradecemos su puntualidad._`;
                      window.open(`https://wa.me/1${currentLoan.phone.replace(/\D/g, '')}?text=${text}`, '_blank');
                    }}
                    className="w-full bg-brand-secondary text-brand-text/70 py-4 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-brand-border transition-all active:scale-95"
                   >
                     <Calendar className="w-4 h-4" /> COMPARTIR PRÓXIMO PAGO
                   </button>
                   <button onClick={closeAllModals} className="w-full bg-brand-secondary text-brand-text/70 py-5 rounded-xl font-black text-[10px] uppercase border border-brand-border transition-all active:scale-95">
                     CERRAR
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Modal Nuevo Préstamo */}
        {showNewLoanModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-surface rounded-2xl w-full max-w-2xl shadow-2xl p-10 relative border border-brand-border"
            >
              <button onClick={closeAllModals} className="absolute top-8 right-8 text-brand-text/20 hover:text-brand-text">
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-2xl font-black text-brand-text mb-8 tracking-tight uppercase">DATOS DEL PRÉSTAMO</h2>
              
              <datalist id="clients-list">{uniqueClients.map(c => <option key={c.id} value={c.client} />)}</datalist>

              <form onSubmit={handleSaveNewLoan} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Nombre del Cliente</label>
                  <input 
                    list="clients-list"
                    required 
                    value={newLoanForm.client}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                    placeholder="Busque o escriba..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Teléfono</label>
                  <input 
                    required 
                    value={newLoanForm.phone}
                    onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                    placeholder="8090000000"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cédula</label>
                  <input 
                    value={newLoanForm.idNumber}
                    onChange={(e) => setNewLoanForm({...newLoanForm, idNumber: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                    placeholder="000-0000000-0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Dirección de Residencia</label>
                  <input 
                    required
                    value={newLoanForm.address}
                    onChange={(e) => setNewLoanForm({...newLoanForm, address: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                    placeholder="Calle, No. Casa, Sector, Ciudad..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Lugar de Trabajo</label>
                  <input 
                    required
                    value={newLoanForm.workplace}
                    onChange={(e) => setNewLoanForm({...newLoanForm, workplace: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                    placeholder="Empresa o Negocio donde labora..."
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="bg-brand-bg p-6 rounded-2xl border border-brand-border space-y-6 shadow-inner">
                    <div>
                      <label className="block text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2">Capital a Entregar ($)</label>
                      <input 
                        type="number"
                        required 
                        value={newLoanForm.capital}
                        onChange={(e) => setNewLoanForm({...newLoanForm, capital: e.target.value})}
                        className="w-full border border-brand-border p-4 rounded-xl font-black text-2xl text-brand-primary bg-brand-surface focus:border-brand-primary/50 transition-all outline-none font-mono"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Utilidad</label>
                        <div className="flex gap-2">
                          <select 
                            value={newLoanForm.calcMethod}
                            onChange={(e) => setNewLoanForm({...newLoanForm, calcMethod: e.target.value})}
                            className="bg-brand-secondary border border-brand-border p-3 rounded-xl font-black text-[9px] uppercase outline-none text-brand-text"
                          >
                            <option value="interes">% TASA</option>
                            <option value="fija">$ CUOTA</option>
                          </select>
                          <input 
                            type="number"
                            required 
                            value={newLoanForm.calcMethod === 'interes' ? newLoanForm.interestRate : newLoanForm.fixedQuota}
                            onChange={(e) => setNewLoanForm({...newLoanForm, [newLoanForm.calcMethod === 'interes' ? 'interestRate' : 'fixedQuota']: e.target.value})}
                            className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-surface text-brand-text focus:border-brand-primary/50 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cuotas</label>
                          <input 
                            type="number"
                            required 
                            value={newLoanForm.installments}
                            onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})}
                            className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-surface text-brand-text focus:border-brand-primary/50 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Frecuencia</label>
                          <select 
                            value={newLoanForm.freqDays}
                            onChange={(e) => setNewLoanForm({...newLoanForm, freqDays: e.target.value})}
                            className="w-full border border-brand-border p-4 rounded-xl font-black text-[9px] uppercase bg-brand-surface text-brand-text focus:border-brand-primary/50 outline-none"
                          >
                            <option value="1">DIARIO</option>
                            <option value="7">SEMANAL</option>
                            <option value="15">QUINCENAL</option>
                            <option value="30">MENSUAL</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`md:col-span-2 bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-primary/80 active:scale-[0.98]'}`}
                >
                  {isSubmitting ? 'PROCESANDO...' : 'AUTORIZAR PRÉSTAMO'}
                </button>
                {formError && (
                  <div className="md:col-span-2 bg-brand-red/10 border border-brand-red/20 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-red shrink-0" />
                    <p className="text-[10px] font-black text-brand-red uppercase tracking-tight">{formError}</p>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal Renovación */}
        {showRenewModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-surface rounded-2xl w-full max-w-xl shadow-2xl p-10 relative border border-brand-border"
            >
              <button onClick={closeAllModals} className="absolute top-8 right-8 text-brand-text/20 hover:text-brand-text">
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-8">
                <h2 className="text-2xl font-black text-brand-text tracking-tight uppercase">RENOVAR PRÉSTAMO</h2>
                <p className="text-brand-text/40 font-bold text-[10px] uppercase tracking-widest">Renovación para: {currentLoan.client}</p>
              </div>

              <div className="bg-brand-red/5 border border-brand-red/10 p-6 rounded-2xl mb-8 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-brand-red uppercase tracking-widest mb-1">Saldo Actual a Liquidar</p>
                  <p className="text-2xl font-black text-brand-red font-mono">{formatMoney(currentLoan.remaining)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-brand-text/40 uppercase tracking-widest mb-1">Caja Disponible</p>
                  <p className="text-lg font-bold text-brand-text font-mono">{formatMoney(totals.caja)}</p>
                </div>
              </div>

              <form onSubmit={handleRenewLoan} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2">Nuevo Capital Deseado ($)</label>
                  <input 
                    type="number"
                    required 
                    value={renewForm.capital}
                    onChange={(e) => setRenewForm({...renewForm, capital: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-black text-2xl text-brand-primary bg-brand-bg focus:border-brand-primary/50 transition-all outline-none font-mono"
                    placeholder="0.00"
                  />
                  {renewForm.capital && (
                    <p className="mt-2 text-[10px] font-black uppercase text-brand-text/50">
                      Entregar al cliente neto: <span className="text-brand-green">{formatMoney(parseFloat(renewForm.capital) - currentLoan.remaining)}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Utilidad</label>
                    <div className="flex gap-2">
                      <select 
                        value={renewForm.calcMethod}
                        onChange={(e) => setRenewForm({...renewForm, calcMethod: e.target.value})}
                        className="bg-brand-secondary border border-brand-border p-3 rounded-xl font-black text-[9px] uppercase outline-none text-brand-text"
                      >
                        <option value="interes">% TASA</option>
                        <option value="fija">$ CUOTA</option>
                      </select>
                      <input 
                        type="number"
                        required 
                        value={renewForm.calcMethod === 'interes' ? renewForm.interestRate : renewForm.fixedQuota}
                        onChange={(e) => setRenewForm({...renewForm, [renewForm.calcMethod === 'interes' ? 'interestRate' : 'fixedQuota']: e.target.value})}
                        className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cuotas</label>
                    <input 
                      type="number"
                      required 
                      value={renewForm.installments}
                      onChange={(e) => setRenewForm({...renewForm, installments: e.target.value})}
                      className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 outline-none font-mono"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'hover:bg-brand-primary/80 active:scale-[0.98]'}`}
                >
                  {isSubmitting ? 'PROCESANDO...' : 'PROCESAR RENOVACIÓN'}
                </button>

                {formError && (
                  <div className="bg-brand-red/10 border border-brand-red/20 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-red shrink-0" />
                    <p className="text-[10px] font-black text-brand-red uppercase tracking-tight">{formError}</p>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal Plan de Pagos */}
        {showScheduleModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-brand-surface rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-brand-border shadow-2xl"
            >
              <div className="bg-brand-surface p-8 border-b border-brand-border relative">
                <button onClick={closeAllModals} className="absolute top-8 right-8 text-brand-text/20 hover:text-brand-text">
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-brand-bg border border-brand-border p-3 rounded-xl shadow-inner"><ListChecks className="w-6 h-6 text-brand-primary" /></div>
                  <h2 className="text-2xl font-black tracking-tight uppercase truncate max-w-[400px] text-brand-text">{currentLoan.client}</h2>
                </div>
                <div className="grid grid-cols-2 gap-12 pt-4 border-t border-brand-border/10">
                  <div>
                    <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Inició Préstamo</p>
                    <p className="font-bold text-brand-text/60">{currentLoan.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Saldo por Cobrar</p>
                    <p className="text-xl font-black text-brand-primary font-mono">{formatMoney(currentLoan.remaining)}</p>
                  </div>
                </div>
              </div>

                  <div className="flex-1 overflow-y-auto p-10 bg-white text-slate-900 selection:bg-brand-primary" id="schedule-content">
                    <div className="text-center mb-8 border-b-2 border-brand-primary pb-4">
                      <h2 className="text-4xl font-black text-brand-primary uppercase tracking-tighter">PRESTAFÁCIL</h2>
                      <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase mt-2">Plan de Pagos Detallado</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8 mb-8 text-[10px]">
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cliente</p>
                          <p className="font-bold uppercase text-slate-900">{currentLoan.client}</p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Monto Adeudado</p>
                          <p className="font-bold text-slate-900">{formatMoney(currentLoan.debt)}</p>
                       </div>
                    </div>

                    <table className="w-full text-left">
                       <thead>
                          <tr className="border-b-2 border-slate-100">
                             <th className="py-2 text-[10px] font-black text-slate-400 uppercase">No.</th>
                             <th className="py-2 text-[10px] font-black text-slate-400 uppercase">Vencimiento</th>
                             <th className="py-2 text-[10px] font-black text-slate-400 uppercase text-right">Monto</th>
                             <th className="py-2 text-[10px] font-black text-slate-400 uppercase text-right">Estado</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {calculateSchedule(currentLoan).map(s => (
                             <tr key={s.num}>
                                <td className="py-3 font-bold text-xs text-slate-900">{s.num}</td>
                                <td className="py-3 font-bold text-xs text-slate-900">{s.date}</td>
                                <td className="py-3 font-bold text-xs text-right font-mono text-slate-900">{formatMoney(s.amount)}</td>
                                <td className={`py-3 font-black text-[9px] text-right uppercase ${s.status === 'PAGADO' ? 'text-brand-green' : s.status === 'MORA' ? 'text-brand-red' : 'text-brand-primary'}`}>{s.status}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>

                  <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3 bg-brand-bg shadow-inner">
                {calculateSchedule(currentLoan).map((s) => (
                  <div key={s.num} className={`bg-brand-surface p-4 rounded-xl border border-brand-border flex justify-between items-center ${s.status === 'PAGADO' ? 'opacity-30' : 'shadow-sm'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded bg-brand-bg border border-brand-border flex items-center justify-center font-bold text-[10px] text-brand-text/40">
                        {s.num}
                      </div>
                      <div>
                        <p className="font-black text-sm text-brand-text font-mono">
                          {formatMoney(s.amount)}
                          {s.mora > 0 && <span className="text-[9px] text-brand-red ml-2 uppercase">Incluye Mora {formatMoney(s.mora)}</span>}
                        </p>
                        <p className="text-[9px] font-bold text-brand-text/30 uppercase">{s.date}</p>
                      </div>
                    </div>
                    <div className={`text-[9px] font-black uppercase px-3 py-1.5 rounded border ${s.status === 'PAGADO' ? 'bg-brand-green/10 text-brand-green border-brand-green/20' : s.status === 'MORA' ? 'bg-brand-red/10 text-brand-red border-brand-red/20' : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'}`}>
                      {s.status === 'PAGADO' ? <Check className="w-3 h-3" /> : s.status}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 border-t border-brand-border flex gap-4 bg-brand-surface">
                <button 
                  onClick={handleDownloadSchedulePDF}
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-primary text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all font-mono"
                >
                  <Download className="w-4 h-4" /> DESCARGAR PLAN PARA WHATSAPP
                </button>
                <button 
                  onClick={closeAllModals}
                  className="flex-1 bg-brand-primary text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition-all"
                >
                  CERRAR
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Editar */}
        {showEditModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-brand-surface rounded-2xl w-full max-w-xl shadow-2xl p-10 relative border border-brand-border"
            >
              <button onClick={closeAllModals} className="absolute top-8 right-8 text-brand-text/20 hover:text-brand-text">
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-2xl font-black text-brand-text mb-8 tracking-tight uppercase">Editar Préstamo</h2>
              
              <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cliente</label>
                  <input 
                    required 
                    value={editForm.client}
                    onChange={(e) => setEditForm({...editForm, client: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Teléfono</label>
                  <input 
                    required 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cédula</label>
                  <input 
                    value={editForm.idNumber}
                    onChange={(e) => setEditForm({...editForm, idNumber: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Dirección</label>
                  <input 
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Trabajo</label>
                  <input 
                    value={editForm.workplace}
                    onChange={(e) => setEditForm({...editForm, workplace: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Saldo Actual</label>
                  <input 
                    type="number"
                    value={editForm.remaining}
                    onChange={(e) => setEditForm({...editForm, remaining: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Estado</label>
                  <select 
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value as any})}
                    className="w-full border border-brand-border p-4 rounded-xl font-black text-[10px] uppercase bg-brand-bg text-brand-text outline-none"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="PAGADO">PAGADO</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`md:col-span-2 bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'hover:bg-brand-primary/80 active:scale-[0.98]'}`}
                >
                  {isSubmitting ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                </button>
                {formError && <p className="md:col-span-2 text-brand-red text-[10px] font-black uppercase text-center">{formError}</p>}
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal Contrato */}
        {showContractModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.99, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-[0_0_100px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col max-h-[92vh] border border-brand-border"
            >
              <div className="p-6 border-b border-brand-border flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary/10 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-brand-primary" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Contrato Digital de Préstamo</h2>
                </div>
                <button onClick={closeAllModals} className="text-slate-400 hover:text-slate-900 transition-colors"><X /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-white text-slate-900 selection:bg-brand-primary" id="contract-view" style={{ color: '#0f172a' }}>
                <div className="max-w-2xl mx-auto space-y-10 font-serif leading-relaxed text-justify">
                  <div className="text-center space-y-2 border-b-2 border-doc-primary pb-6 mb-10">
                    <h1 className="text-3xl font-black tracking-tighter uppercase">Pagaré Notarial</h1>
                    <p className="text-[10px] font-black tracking-[0.4em] text-doc-secondary uppercase">PrestaFácil - Servicios Financieros</p>
                  </div>

                  <p className="text-sm">
                    Yo, <span className="font-black underline px-1">{currentLoan.client}</span>, 
                    dominicano(a), mayor de edad, titular de la cédula de identidad No. 
                    <span className="font-black underline px-1">{currentLoan.idNumber || "__________"}</span>, 
                    con domicilio y residencia en <span className="font-bold">{currentLoan.address || "____________________"}</span> 
                    y laborando actualmente en <span className="font-bold">{currentLoan.workplace || "____________________"}</span>,
                    por medio del presente documento legal:
                  </p>

                  <div className="bg-doc-bg p-6 border-l-4 border-doc-primary italic text-sm">
                    "RECONOZCO de manera formal y expresa, haber recibido a mi entera satisfacción de la entidad 
                    <span className="font-bold"> PRESTAFÁCIL</span>, la suma de 
                    <span className="font-black"> {formatMoney(currentLoan.principal)} </span> 
                    en calidad de préstamo personal."
                  </div>

                  <div className="space-y-4 text-sm">
                    <p>
                      Me comprometo a pagar la suma total adeudada de <span className="font-black">{formatMoney(currentLoan.debt)}</span>, 
                      incluyendo los intereses generados, mediante un plan de 
                      <span className="font-bold"> {currentLoan.installments} cuotas</span> de 
                      <span className="font-bold"> {formatMoney(currentLoan.debt / currentLoan.installments)}</span>, 
                      con una frecuencia de pago <span className="font-bold">{currentLoan.freqDays} días</span>.
                    </p>
                    
                    <p>
                      <span className="font-black underline">PENALIDAD POR INCUMPLIMIENTO:</span> El deudor acepta y reconoce que, en caso de retraso en el pago de cualquier cuota según la fecha establecida en el plan de pagos, se generará de forma automática un interés penal por mora equivalente al <span className="font-bold text-doc-accent">5% DIARIO</span> sobre el monto total de la deuda restante, hasta la regularización del pago.
                    </p>

                    <p>
                      El incumplimiento de dos (2) cuotas consecutivas otorgará al acreedor el derecho de ejecutar 
                      la totalidad de la deuda restante de manera inmediata, renunciando el suscrito a cualquier 
                      procedimiento de conciliación previo.
                    </p>
                  </div>

                  <div className="pt-20 grid grid-cols-2 gap-20">
                    <div className="text-center">
                      <div className="border-t-2 border-doc-primary pt-3">
                        <p className="font-black text-xs uppercase tracking-widest">{currentLoan.client}</p>
                        <p className="text-[10px] text-doc-secondary font-bold mt-1">EL DEUDOR</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t-2 border-doc-primary pt-3">
                        <p className="font-black text-xs uppercase tracking-widest">PRESTAFÁCIL</p>
                        <p className="text-[10px] text-doc-secondary font-bold mt-1">EL ACREEDOR</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-10 text-[9px] text-doc-secondary text-center uppercase tracking-widest font-sans">
                    Fecha de emisión: {new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-brand-border bg-brand-surface flex gap-4 no-print">
                <button 
                  onClick={async () => {
                    const docElement = document.getElementById('contract-view');
                    if (!docElement) return;
                    setIsSubmitting(true);
                    try {
                      const docElement = document.getElementById('contract-view');
                      if (!docElement) return;
                      
                      const canvas = await html2canvas(docElement, { 
                        scale: 1.5,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        windowHeight: docElement.scrollHeight,
                        onclone: (clonedDoc) => {
                          const el = clonedDoc.getElementById('contract-view');
                          if (el) {
                            clonedDoc.querySelectorAll('style, link').forEach(s => s.remove());
                            const style = clonedDoc.createElement('style');
                            style.innerHTML = `
                              #contract-view { font-family: serif; background: #ffffff; color: #0f172a; line-height: 1.6; }
                              .max-w-4xl { max-width: 56rem; }
                              .mx-auto { margin-left: auto; margin-right: auto; }
                              .p-12 { padding: 3rem; }
                              .bg-white { background-color: #ffffff; }
                              .border { border: 1px solid #e2e8f0; }
                              .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
                              .rounded-3xl { border-radius: 1.5rem; }
                              .mb-10 { margin-bottom: 2.5rem; }
                              .text-4xl { font-size: 2.25rem; }
                              .font-black { font-weight: 900; }
                              .text-slate-900 { color: #0f172a; }
                              .text-slate-400 { color: #94a3b8; }
                              .text-sm { font-size: 0.875rem; }
                              .tracking-\\[0\\.3em\\] { letter-spacing: 0.3em; }
                              .font-bold { font-weight: 700; }
                              .mb-12 { margin-bottom: 3rem; }
                              .grid { display: grid; }
                              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                              .gap-8 { gap: 2rem; }
                              .p-6 { padding: 1.5rem; }
                              .bg-slate-50 { background-color: #f8fafc; }
                              .rounded-2xl { border-radius: 1rem; }
                              .text-xs { font-size: 0.75rem; }
                              .text-slate-500 { color: #64748b; }
                              .text-lg { font-size: 1.125rem; }
                              .text-slate-800 { color: #1e293b; }
                              .space-y-8 > * + * { margin-top: 2rem; }
                              .text-\\[15px\\] { font-size: 15px; }
                              .text-slate-700 { color: #334155; }
                              .leading-relaxed { line-height: 1.625; }
                              .text-justify { text-align: justify; }
                              .pl-4 { padding-left: 1rem; }
                              .border-l-4 { border-left-width: 4px; }
                              .border-blue-600 { border-left-color: #2563eb; }
                              .italic { font-style: italic; }
                              .flex { display: flex; }
                              .justify-between { justify-content: space-between; }
                              .mt-20 { margin-top: 5rem; }
                              .text-center { text-align: center; }
                              .w-48 { width: 12rem; }
                              .pt-4 { padding-top: 1rem; }
                              .border-t-2 { border-top-width: 2px; }
                              .border-slate-200 { border-top-color: #e2e8f0; }
                              .mb-1 { margin-bottom: 0.25rem; }
                              .text-slate-600 { color: #475569; }
                              .text-\\[10px\\] { font-size: 10px; }
                              .tracking-widest { letter-spacing: 0.1em; }
                            `;
                            clonedDoc.head.appendChild(style);
                            
                            el.style.height = 'auto';
                            el.style.overflow = 'visible';
                            el.style.width = '210mm'; 
                          }
                        }
                      });
                      
                      const imgData = canvas.toDataURL('image/jpeg', 0.95);
                      const pdf = new jsPDF({
                        orientation: 'p',
                        unit: 'mm',
                        format: 'a4'
                      });
                      
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight = pdf.internal.pageSize.getHeight();
                      
                      const canvasWidth = canvas.width;
                      const canvasHeight = canvas.height;
                      
                      const imgWidth = pdfWidth - 20; 
                      const imgHeight = (canvasHeight * imgWidth) / canvasWidth;
                      
                      let heightLeft = imgHeight;
                      let position = 10; 
                      let page = 1;

                      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
                      heightLeft -= (pdfHeight - 20);

                      while (heightLeft > 0) {
                        position = 10 - (pdfHeight - 20) * page;
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
                        heightLeft -= (pdfHeight - 20);
                        page++;
                      }

                      pdf.save(`Contrato_${currentLoan.client.replace(/\s+/g, '_')}.pdf`);
                    } catch (e) {
                      console.error('PDF error:', e);
                      alert("Error al generar PDF. Use la opción 'IMPRIMIR' y elija 'Guardar como PDF'.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 bg-brand-primary text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'hover:bg-brand-primary/80'}`}
                >
                  {isSubmitting ? 'GENERANDO...' : <><Download className="w-4 h-4" /> DESCARGAR PDF</>}
                </button>
                <button 
                  onClick={() => printElement('contract-view')}
                  className="flex-1 bg-brand-secondary text-brand-text/70 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-brand-border hover:bg-brand-secondary/80 transition-all"
                >
                  <Printer className="w-4 h-4" /> IMPRIMIR
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Gestión de Caja */}
        {showCashModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-brand-surface rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-brand-border"
            >
              <div className="bg-brand-surface p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg">
                <h3 className="font-black text-lg uppercase tracking-tight text-brand-text">CONTROL DE CAJA</h3>
                <button onClick={closeAllModals} className="text-brand-text/20 hover:text-brand-text"><X /></button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8 bg-brand-bg/50">
                {/* Formulario rápido */}
                <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <select 
                      value={cashForm.type}
                      onChange={(e) => setCashForm({...cashForm, type: e.target.value as any})}
                      className="bg-brand-bg border border-brand-border rounded-xl p-4 font-black text-[10px] uppercase text-brand-text outline-none focus:border-brand-primary/50"
                    >
                      <option value="INYECCION">INYECCIÓN (+)</option>
                      <option value="RETIRO">RETIRO (-)</option>
                    </select>
                    <input 
                      type="number"
                      placeholder="Monto"
                      value={cashForm.amount}
                      onChange={(e) => setCashForm({...cashForm, amount: e.target.value})}
                      className="bg-brand-bg border border-brand-border rounded-xl p-4 font-black text-brand-text outline-none focus:border-brand-primary/50 font-mono shadow-inner"
                    />
                    <input 
                      type="text"
                      placeholder="Concepto del movimiento..."
                      value={cashForm.concept}
                      onChange={(e) => setCashForm({...cashForm, concept: e.target.value})}
                      className="col-span-2 bg-brand-bg border border-brand-border rounded-xl p-4 font-bold text-xs text-brand-text outline-none focus:border-brand-primary/50"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (!user || !cashForm.amount || !cashForm.concept) return;
                      const am = parseFloat(cashForm.amount);
                      if (cashForm.type === 'RETIRO' && am > totals.caja) return alert("Fondos insuficientes.");
                      await addDoc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'), {
                        ...cashForm, amount: am, date: new Date().toISOString()
                      });
                      setCashForm({ type: 'INYECCION', amount: '', concept: '' });
                    }}
                    className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition-all active:scale-95"
                  >
                    REGISTRAR MOVIMIENTO
                  </button>
                </div>

                {/* Lista */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest px-2">Historial Reciente</p>
                  <div className="divide-y divide-brand-border/50">
                    {transactions.map(t => (
                      <div key={t.id} className="py-5 flex justify-between items-center group">
                        <div className="flex gap-4 items-center">
                          <div className={`p-3 rounded-xl border ${t.type === 'RETIRO' ? 'bg-brand-red/10 text-brand-red border-brand-red/20' : 'bg-brand-green/10 text-brand-green border-brand-green/20'}`}>
                            {t.type === 'RETIRO' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase text-brand-text mb-1 tracking-tight">{t.concept}</p>
                            <p className="text-[9px] font-bold text-brand-text/30 uppercase">{new Date(t.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className={`font-black text-lg font-mono tracking-tighter ${t.type === 'RETIRO' ? 'text-brand-red' : 'text-brand-green'}`}>
                          {t.type === 'RETIRO' ? '-' : '+'}{formatMoney(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Respaldos / Migración */}
        {showMigrationModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-brand-surface rounded-2xl w-full max-w-2xl p-10 shadow-2xl border border-brand-border"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black mb-1 uppercase tracking-tight text-brand-text">RESPALDO DE DATOS</h2>
                  <p className="text-brand-text/30 font-bold text-[10px] uppercase tracking-widest">Sincronización manual de registros</p>
                </div>
                <button onClick={() => setShowMigrationModal(false)} className="text-brand-text/20 hover:text-brand-text"><X /></button>
              </div>
              
              <div className="flex flex-col gap-4">
                <textarea 
                  value={migrationText}
                  onChange={(e) => setMigrationText(e.target.value)}
                  placeholder="Pegue aquí los datos para restaurar o dele a 'GENERAR COPIA' para ver el respaldo actual..."
                  className="w-full h-48 bg-brand-bg border border-brand-border shadow-inner rounded-xl p-5 font-mono text-[10px] mb-4 focus:border-brand-primary/50 outline-none text-brand-text"
                />

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const backup = { loans, transactions, timestamp: new Date().toISOString() };
                      setMigrationText(JSON.stringify(backup, null, 2));
                      toast.success("Respaldo generado");
                    }}
                    className="flex-1 bg-brand-green text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-green/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> GENERAR COPIA
                  </button>
                  <button 
                    onClick={async () => {
                      if(!migrationText.trim()) return alert("Pegue los datos primero.");
                      if(!confirm("⚠️ CUIDADO: Esto reemplazará todo el sistema con los datos cargados. ¿Continuar?")) return;
                      setIsSubmitting(true);
                      try {
                        const rawData = JSON.parse(migrationText);
                        
                        // Normalización de datos (Soporte para formato viejo)
                        const normalizedLoans = (rawData.loans || []).map((l: any) => {
                          // Si es formato viejo (detectamos totalDebt), mapeamos campos
                          if (l.totalDebt !== undefined && l.debt === undefined) {
                            const debt = Number(l.totalDebt || 0);
                            const paid = Number(l.paid || 0);
                            // Convertir fecha YYYY-MM-DD a DD/MM/YYYY
                            let formattedDate = new Date().toLocaleDateString('es-DO');
                            if (l.startDate && l.startDate.includes('-')) {
                              const [y, m, d] = l.startDate.split('-');
                              formattedDate = `${d}/${m}/${y}`;
                            }
                            return {
                              client: l.client || "Sin nombre",
                              date: formattedDate,
                              principal: Number(l.principal || 0),
                              debt: debt,
                              remaining: Math.max(0, debt - paid),
                              status: l.status === 'completed' ? 'PAGADO' : 'ACTIVO',
                              installments: Number(l.term || 1),
                              freqDays: Number(l.freqDays || 15),
                              phone: l.phone || "",
                              address: l.address || "",
                              createdAt: l.createdAt || new Date().toISOString()
                            };
                          }
                          return l;
                        });

                        const normalizedTransactions = rawData.transactions || [];
                        
                        const batch = writeBatch(db);
                        
                        // Limpiar actual
                        loans.forEach(l => batch.delete(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', l.id)));
                        transactions.forEach(t => batch.delete(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions', t.id)));

                        // Cargar nuevos
                        normalizedLoans.forEach((l: any) => {
                          const { id, ...clean } = l;
                          batch.set(doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans')), clean);
                        });
                        
                        normalizedTransactions.forEach((t: any) => {
                          const { id, ...clean } = t;
                          batch.set(doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions')), clean);
                        });

                        await batch.commit();
                        toast.success("Sistema restaurado y datos migrados");
                        setShowMigrationModal(false);
                        setMigrationText('');
                      } catch (e: any) { 
                        console.error(e);
                        alert("Error: " + e.message); 
                      }
                      finally { setIsSubmitting(false); }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 bg-brand-red text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-red/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> {isSubmitting ? 'PROCESANDO...' : 'RESTAURAR'}
                  </button>
                </div>
                <button onClick={() => setShowMigrationModal(false)} className="w-full bg-brand-secondary text-brand-text/40 py-5 rounded-xl font-black uppercase text-[10px] border border-brand-border transition-all">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Plus on Mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden no-print">
        <button 
          onClick={() => setShowNewLoanModal(true)}
          className="bg-brand-primary text-white w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-brand-primary"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
