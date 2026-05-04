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
  Phone, Home, Briefcase, Check, Lock, Trash, Upload, Download, Database,
  MapPin, User, Moon, Sun, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser, 
  GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, 
  deleteDoc, writeBatch, query, orderBy, getDocFromServer, getDoc, serverTimestamp 
} from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
  startDate?: string;
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
  loanId?: string;
  clientName?: string;
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const [showEditTransactionModal, setShowEditTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editTransactionForm, setEditTransactionForm] = useState({ amount: '', concept: '', date: '' });
  
  // Formularios
  const [migrationText, setMigrationText] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [activeScheduleTab, setActiveScheduleTab] = useState<'plan' | 'pagos'>('plan');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [lastPaidAmount, setLastPaidAmount] = useState(0);
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', idNumber: '', address: '', workplace: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: '15'
  });
  const [editForm, setEditForm] = useState({ client: '', phone: '', idNumber: '', address: '', workplace: '', debt: '', remaining: '', status: '', fixedQuota: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("ERROR DE DOMINIO: El dominio de esta aplicación no está autorizado en tu consola de Firebase (Authentication > Settings > Authorized domains). Copia la URL de la barra de navegación y agrégala allí.");
      } else {
        setAuthError("Error al iniciar sesión: " + error.message);
      }
    }
  };

  const ALLOWED_EMAIL = "rafaelsantos1902a@gmail.com";

  const loginWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    // Restricción de correo
    if (email.toLowerCase() !== ALLOWED_EMAIL) {
      setAuthError("ACCESO DENEGADO: Por el momento, este sistema es para uso exclusivo del administrador autorizado.");
      return;
    }

    setAuthError(null);
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Cuenta creada exitosamente");
      }
    } catch (error: any) {
      console.error("Email auth error:", error);
      let msg = "Error: " + error.message;
      if (error.code === 'auth/operation-not-allowed') {
        const consoleLink = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
        msg = `ERROR: Debes habilitar 'Correo electrónico/Contraseña' en tu consola de Firebase. \n1. Entra aquí: ${consoleLink} \n2. Haz clic en 'Correo electrónico/Contraseña' y actívalo. \n3. No olvides pulsar en 'Guardar'.`;
      } else if (error.code === 'auth/user-not-found') {
        msg = "Usuario no encontrado.";
      } else if (error.code === 'auth/wrong-password') {
        msg = "Contraseña incorrecta.";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "El correo ya está en uso.";
      } else if (error.code === 'auth/invalid-email') {
        msg = "Correo inválido.";
      }
      setAuthError(msg);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError("Por favor, ingresa tu correo electrónico para enviarte el enlace de recuperación.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.");
    } catch (error: any) {
      setAuthError("Error: " + error.message);
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
    
    // Utilidad Real = Interés efectivamente cobrado basado en el historial de transacciones
    // Calculado proporcionalmente por el ratio de interés de cada préstamo
    const ganancia = transactions.reduce((t, tr) => {
      const concept = tr.concept.toLowerCase();
      const isCollection = concept.includes('abono') || concept.includes('cobro') || concept.includes('pago') || concept.includes('renovación') || concept.includes('recaudo') || concept.includes('recaudar');
      if (!isCollection) return t;

      const loan = loans.find(l => l.id === tr.loanId);
      if (loan && loan.debt > 0) {
        const interestRatio = (loan.debt - loan.principal) / loan.debt;
        return t + (tr.amount * interestRatio);
      }
      return t;
    }, 0);

    const recaudado = transactions.reduce((t, tr) => {
      const concept = tr.concept.toLowerCase();
      if (concept.includes('abono') || concept.includes('cobro') || concept.includes('pago') || concept.includes('recaudo') || concept.includes('recaudar')) {
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

  const [showGrowthModal, setShowGrowthModal] = useState(false);
  
  // Formatos
  const formatMoney = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  // Estadísticas de Crecimiento Real
  const growthStats = useMemo(() => {
    const monthlyData: Record<string, { total: number, interest: number, count: number }> = {};
    const annualData: Record<string, { total: number, interest: number }> = {};

    transactions.forEach(tr => {
      const concept = tr.concept.toLowerCase();
      const isCollection = concept.includes('abono') || concept.includes('cobro') || concept.includes('pago') || concept.includes('renovación') || concept.includes('recaudo') || concept.includes('recaudar');
      if (!isCollection) return;

      // Intentar analizar la fecha de forma robusta
      let date: Date;
      if (typeof tr.date === 'number') {
        date = new Date(tr.date);
      } else if (typeof tr.date === 'string' && tr.date.includes('/')) {
        const parts = tr.date.split('/');
        date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      } else {
        date = new Date(tr.date);
      }

      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = `${date.getFullYear()}`;

      if (!monthlyData[monthKey]) monthlyData[monthKey] = { total: 0, interest: 0, count: 0 };
      if (!annualData[yearKey]) annualData[yearKey] = { total: 0, interest: 0 };

      monthlyData[monthKey].total += tr.amount;
      monthlyData[monthKey].count += 1;
      annualData[yearKey].total += tr.amount;

      // Calcular proporción de interés real percibido
      const loan = loans.find(l => l.id === tr.loanId);
      if (loan && loan.debt > 0) {
        const interestRatio = (loan.debt - loan.principal) / loan.debt;
        const interestAmount = tr.amount * interestRatio;
        monthlyData[monthKey].interest += interestAmount;
        annualData[yearKey].interest += interestAmount;
      }
    });

    return { 
      monthly: Object.entries(monthlyData).sort((a, b) => b[0].localeCompare(a[0])),
      annual: Object.entries(annualData).sort((a, b) => b[0].localeCompare(a[0]))
    };
  }, [transactions, loans]);

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
      doc.text(receiptDate || new Date().toLocaleDateString(), 70, y, { align: 'right' });

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
    if (loan.startDate) {
      startDate = new Date(loan.startDate);
    } else if (loan.date) {
      const parts = loan.date.split('/');
      if (parts.length === 3) {
        // dd/mm/yyyy -> mm/dd/yyyy for Date constructor
        startDate = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      }
    }
    
    if (isNaN(startDate.getTime())) startDate = new Date(); // Fallback if still invalid
    
    const freq = Number(loan.freqDays || 15);
    const totalInst = Math.max(1, Number(loan.installments || 1));
    
    // Si existe una cuota fija definida, usarla. Si no, calcular debt / installments.
    const quotaAmount = loan.fixedQuota && loan.fixedQuota > 0 
      ? loan.fixedQuota 
      : (Number(loan.debt || 0) / totalInst);
    
    let totalPaid = Number(loan.debt || 0) - Number(loan.remaining || 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= totalInst; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (freq * i));
      dueDate.setHours(0, 0, 0, 0);
      
      let amountDue = quotaAmount;
      if (totalPaid > 0) {
        const paymentApplied = Math.min(totalPaid, quotaAmount);
        amountDue -= paymentApplied;
        totalPaid -= paymentApplied;
      }
      
      const isPaid = amountDue <= 0.01;

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
        timestamp: dueDate.getTime(),
        amount: quotaAmount, // Monto FIJO acordado
        amountDue: Math.max(0, amountDue),
        mora: moraAmount,
        status: status
      });
    }
    return schedule;
  };

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
        startDate: new Date().toISOString(), // Use ISO for reliable parsing
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
    const progress = Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100);
    const now = new Date().toISOString();
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', currentLoan.id);
      const updateData = { 
        remaining: Number(resta.toFixed(2)), 
        progress: progress, 
        status: (resta <= 0.01) ? 'PAGADO' : 'ACTIVO',
        updatedAt: serverTimestamp()
      };
      
      batch.update(loanRef, updateData);

      const transRef = doc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'));
      batch.set(transRef, { 
        type: 'INYECCION', 
        amount: monto, 
        concept: `Recaudo Cuota - ${currentLoan.client}`, 
        loanId: currentLoan.id,
        clientName: currentLoan.client,
        date: now
      });

      await batch.commit();

      setLastPaidAmount(monto);
      setReceiptDate(new Date(now).toLocaleDateString());
      sendPaymentAlert(currentLoan.client, monto);

      // Actualizar estado local
      setLoans(prev => prev.map(l => l.id === currentLoan.id ? { ...l, ...updateData } : l));
      setCurrentLoan(prev => prev ? { ...prev, ...updateData } : null);

      setPaymentAmount('');
      setShowPaymentModal(false); 
      setShowReceiptModal(true);
      toast.success("Pago registrado correctamente");
    } catch (err: any) { 
      console.error("Payment error:", err);
      setFormError("Error al registrar pago: " + err.message); 
    }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteLoan = async (loanToDelete?: any) => {
    // Si viene de un evento onChange/onClick sin parámetros, loanToDelete será el evento
    const targetLoan = (loanToDelete && typeof loanToDelete === 'object' && 'id' in loanToDelete) ? loanToDelete : currentLoan;
    console.log("Attempting to delete loan:", targetLoan?.id);
    if (!targetLoan || !user) {
      console.error("Target loan or user missing");
      return;
    }
    if (!window.confirm(`⚠️ ¿ELIMINAR PRÉSTAMO POR COMPLETO?\n\nSe borrará a ${targetLoan.client} y todo su historial de pagos de forma permanente.\n\nEsta acción NO se puede deshacer.`)) return;
    
    setIsSubmitting(true);
    try {
      const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', targetLoan.id);
      await deleteDoc(loanRef);
      
      setShowEditModal(false);
      setShowScheduleModal(false);
      setShowPaymentModal(false);
      if (currentLoan?.id === targetLoan.id) setCurrentLoan(null);
      toast.success("Préstamo eliminado correctamente");
    } catch (err: any) {
      console.error("Delete Error:", err);
      toast.error("Error al eliminar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearPastLoans = async () => {
    if (!user || pastLoans.length === 0) return;
    const count = pastLoans.length;
    if (!window.confirm(`⚠️ ¿BORRAR TODO EL HISTORIAL?\n\nSe eliminarán permanentemente los ${count} préstamos finalizados o cancelados de la historia.\n\nEsta acción NO se puede deshacer.`)) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      pastLoans.forEach(l => {
        const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', l.id);
        batch.delete(loanRef);
      });
      await batch.commit();
      toast.success("Historial borrado correctamente");
    } catch (err: any) {
      toast.error("Error al borrar historial: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReversePayment = async (tr: Transaction) => {
    if (!user || !tr) return;
    if (!window.confirm(`⚠️ ADVERTENCIA: ¿Seguro que desea reversar el pago de ${formatMoney(tr.amount)}?\n\n- Se eliminará el registro de caja.\n- Se aumentará el saldo pendiente del préstamo.\n- El progreso se recalculará automáticamente.`)) return;

    setIsSubmitting(true);
    try {
      let lId = tr.loanId;
      if (!lId) {
        const matchingLoan = loans.find(l => 
          l.id === tr.loanId || 
          normalize(l.client) === normalize(tr.clientName || "") ||
          tr.concept.toLowerCase().includes(normalize(l.client))
        );
        if (matchingLoan) lId = matchingLoan.id;
      }

      if (!lId) {
        toast.error("No se pudo identificar el préstamo para devolver los fondos.");
        return;
      }

      const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', lId);
      const lSnap = await getDoc(loanRef);
      
      const batch = writeBatch(db);
      // Eliminar transacción
      batch.delete(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions', tr.id));

      if (lSnap.exists()) {
        const lData = lSnap.data();
        const curRemaining = Number(lData.remaining || 0);
        const newRemaining = Number((curRemaining + tr.amount).toFixed(2));
        const debt = Number(lData.debt || 1);
        
        // Actualizar préstamo: volver a ACTIVO y sumar el monto reversado
        batch.update(loanRef, {
          remaining: newRemaining,
          progress: Math.max(0, Math.min(100, Math.round(((debt - newRemaining) / debt) * 100))),
          status: 'ACTIVO',
          updatedAt: serverTimestamp()
        });

        // Actualización local para UI inmediata
        if (currentLoan && lId === currentLoan.id) {
          setCurrentLoan(prev => prev ? {
            ...prev,
            remaining: newRemaining,
            progress: Math.max(0, Math.min(100, Math.round(((debt - newRemaining) / debt) * 100))),
            status: 'ACTIVO'
          } : null);
        }
      }

      await batch.commit();
      toast.success("Pago reversado y saldo actualizado");
    } catch (error: any) {
      console.error("Reverse Error:", error);
      toast.error("Error al reversar: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  const findMatchingTransaction = (loan: Loan, scheduleEntry?: any) => {
    if (!loan || !transactions.length) return null;
    const scheduleTime = scheduleEntry ? (scheduleEntry.timestamp || new Date(scheduleEntry.date).getTime()) : null;
    const cNameNorm = normalize(loan.client || "");

    // Prioridad 1: Buscar por ID de Préstamo + Número de Cuota (Máxima precisión para nuevos pagos)
    if (scheduleEntry) {
      const idNumMatch = transactions.find(t => 
        t.loanId === loan.id && 
        t.installmentNum === scheduleEntry.num &&
        t.amount > 0
      );
      if (idNumMatch) return idNumMatch;

      // Prioridad 2: Buscar por concepto específico (CUOTA X)
      const conceptMatch = transactions.find(t => 
        t.loanId === loan.id && 
        t.amount > 0 && 
        normalize(t.concept || "").includes(`cuota ${scheduleEntry.num}`)
      );
      if (conceptMatch) return conceptMatch;
    }

    // Prioridad 3: ID de Préstamo + Monto Exacto + Cercanía Temporal
    let filtered = transactions.filter(t => t.loanId === loan.id && t.amount > 0);
    
    if (scheduleEntry && filtered.length > 0) {
      // Buscar uno que tenga el mismo monto (+/- un margen de error por mora o redondeo)
      const targetAmount = scheduleEntry.amount;
      const amountMatches = filtered.filter(t => Math.abs(t.amount - targetAmount) < 0.1);
      
      if (amountMatches.length > 0) {
        return amountMatches.sort((a, b) => {
          if (!scheduleTime) return new Date(b.date).getTime() - new Date(a.date).getTime();
          return Math.abs(new Date(a.date).getTime() - scheduleTime) - Math.abs(new Date(b.date).getTime() - scheduleTime);
        })[0];
      }
    }

    // Prioridad 4: Cercanía temporal simple (ID de Préstamo)
    if (filtered.length > 0) {
      return filtered.sort((a, b) => {
        if (!scheduleTime) return new Date(b.date).getTime() - new Date(a.date).getTime();
        return Math.abs(new Date(a.date).getTime() - scheduleTime) - Math.abs(new Date(b.date).getTime() - scheduleTime);
      })[0];
    }
    
    // Prioridad 5: Nombre / Concepto + Cercanía Temporal (Fallback total)
    const fallback = transactions.filter(t => {
      const tNameNorm = normalize(t.clientName || "");
      const tConceptNorm = normalize(t.concept || "");
      return t.amount > 0 && (tNameNorm === cNameNorm || tConceptNorm.includes(cNameNorm));
    });

    if (fallback.length > 0) {
      return fallback.sort((a, b) => {
        if (!scheduleTime) return new Date(b.date).getTime() - new Date(a.date).getTime();
        return Math.abs(new Date(a.date).getTime() - scheduleTime) - Math.abs(new Date(b.date).getTime() - scheduleTime);
      })[0];
    }

    return null;
  };

  const handleUpdateTransaction = async (tr: Transaction, newDetails: Partial<Transaction>) => {
    if (!user || !tr) return;
    setIsSubmitting(true);
    try {
      const trRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions', tr.id);
      const batch = writeBatch(db);

      // Si cambia el monto, actualizar saldo del préstamo
      if (newDetails.amount !== undefined && newDetails.amount !== tr.amount) {
        const diff = newDetails.amount - tr.amount;
        let lId = tr.loanId;
        if (!lId) {
          const matchingLoan = loans.find(l => 
            l.id === tr.loanId || 
            normalize(l.client) === normalize(tr.clientName || "") ||
            tr.concept.toLowerCase().includes(normalize(l.client))
          );
          if (matchingLoan) lId = matchingLoan.id;
        }

        if (lId) {
          const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', lId);
          const lSnap = await getDoc(loanRef);
          if (lSnap.exists()) {
            const lData = lSnap.data();
            const curRemaining = Number(lData.remaining || 0);
            const newRemaining = Number((curRemaining - diff).toFixed(2));
            const debt = Number(lData.debt || 1);
            
            batch.update(loanRef, {
              remaining: newRemaining,
              progress: Math.max(0, Math.min(100, Math.round(((debt - newRemaining) / debt) * 100))),
              updatedAt: serverTimestamp()
            });

            if (currentLoan && lId === currentLoan.id) {
              setCurrentLoan(prev => prev ? {
                ...prev,
                remaining: newRemaining
              } : null);
            }
          }
        }
      }

      batch.update(trRef, {
        ...newDetails,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast.success("Movimiento actualizado");
    } catch (err: any) {
      console.error("Update Transaction Error:", err);
      toast.error("Error al actualizar: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handlePrintOldReceipt = (tr: Transaction) => {
    // Buscar el préstamo por ID, clientName o analizando el concepto
    const tLoanId = tr.loanId || "";
    const tClientNorm = normalize(tr.clientName || "");
    const tConceptNorm = normalize(tr.concept || "");

    const loan = loans.find(l => l.id === tLoanId) || 
                 loans.find(l => {
                   const cNameNorm = normalize(l.client || "");
                   const nameParts = cNameNorm.split(' ').filter(p => p.length > 2);
                   
                   // Si el nombre grabado en la transacción coincide exactamente
                   if (tClientNorm !== "" && cNameNorm === tClientNorm) return true;
                   
                   // Si el nombre del cliente del sistema está contenido en el concepto del movimiento
                   if (tConceptNorm.includes(cNameNorm)) return true;

                   // Si alguna parte importante del nombre del cliente está en el concepto
                   if (nameParts.length > 0 && nameParts.some(part => tConceptNorm.includes(part))) return true;

                   return false;
                 });

    if (!loan) {
      return toast.error("No se pudo vincular esta transacción con un préstamo. Verifique que el nombre del cliente coincida con el registro del préstamo.");
    }
    
    setCurrentLoan(loan);
    setLastPaidAmount(tr.amount);
    setPaymentAmount(String(tr.amount));
    setReceiptDate(new Date(tr.date).toLocaleDateString());
    setShowReceiptModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    setFormError(null);
    setIsSubmitting(true);
    
    // Validar monto para evitar errores de base de datos
    const parsedRemaining = parseFloat(String(editForm.remaining).replace(',', '.'));
    if (isNaN(parsedRemaining)) {
      setFormError("El saldo pendiente debe ser un número válido.");
      setIsSubmitting(false);
      return;
    }

    try {
      const loanRef = doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'loans', currentLoan.id);
      
      // Recalcular progreso si cambia el saldo
      const debt = currentLoan.debt || 1; // Evitar división por cero
      const newProgress = Math.round(((debt - parsedRemaining) / debt) * 100);
      const parsedFixedQuota = editForm.fixedQuota ? parseFloat(editForm.fixedQuota) : null;

      const updateFields = {
        client: editForm.client.trim(),
        phone: editForm.phone.trim(),
        idNumber: editForm.idNumber ? editForm.idNumber.trim() : '',
        address: editForm.address ? editForm.address.trim() : '',
        workplace: editForm.workplace ? editForm.workplace.trim() : '',
        status: editForm.status,
        remaining: parsedRemaining,
        fixedQuota: parsedFixedQuota,
        progress: Math.max(0, Math.min(100, newProgress))
      };

      await updateDoc(loanRef, updateFields);
      
      const updatedLoan = { ...currentLoan, ...updateFields };
      setLoans(prev => prev.map(l => l.id === currentLoan.id ? updatedLoan : l));
      setCurrentLoan(updatedLoan);

      closeAllModals();
      toast.success("Información del cliente actualizada.");
      setSystemMessage("✅ Datos actualizados correctamente.");
    } catch (err: any) {
      console.error("Error updating loan:", err);
      setFormError(`Error al actualizar: ${err.message || 'Intente de nuevo'}`);
      toast.error("No se pudo actualizar la información.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLoans = loans.filter(l => l.status === 'ACTIVO');
  const pastLoans = loans.filter(l => l.status !== 'ACTIVO');
  const filteredLoans = (activeTab === 'activos' ? activeLoans : pastLoans).filter(l => 
    l.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownloadPDF = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
      toast.error("No se encontró el contenido para generar el PDF");
      return;
    }

    const loadingToast = toast.loading("Generando PDF...");

    try {
      // Aplicar clase especial para desactivar oklch y ocultar botones
      element.classList.add('pdf-capture-active');
      const buttons = element.querySelectorAll('.no-print');
      buttons.forEach((btn: any) => btn.style.setProperty('display', 'none', 'important'));

      // Dar un pequeño respiro para que el DOM se actualice
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          // 1. Force light mode and sanitize basic colors
          const root = clonedDoc.documentElement;
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
          clonedDoc.body.style.backgroundColor = '#ffffff';
          clonedDoc.body.style.color = '#000000';
          
          // 2. Brutal safety style to kill animations and force hex variables
          // We include every possible variable that might be using oklch/oklab
          const safetyStyle = clonedDoc.createElement('style');
          safetyStyle.innerHTML = `
            * {
              transition: none !important;
              animation: none !important;
              transition-duration: 0s !important;
              transition-property: none !important;
            }
            :root {
              --bg: #ffffff !important;
              --surface: #ffffff !important;
              --card: #ffffff !important;
              --border: #e2e8f0 !important;
              --text: #000000 !important;
              --text-muted: #64748b !important;
              --text-dim: #94a3b8 !important;
              --secondary: #f1f5f9 !important;
              --brand-primary: #2563eb !important;
              --brand-text: #000000 !important;
              --brand-bg: #ffffff !important;
              --tw-text-opacity: 1 !important;
              --tw-bg-opacity: 1 !important;
              --tw-border-opacity: 1 !important;
              --color-brand-primary: #2563eb !important;
              --color-slate-900: #0f172a !important;
              --color-slate-800: #1e293b !important;
              --color-slate-700: #334155 !important;
              --color-slate-600: #475569 !important;
              --color-slate-500: #64748b !important;
              --tw-color-brand-primary: #2563eb !important;
              --tw-color-brand-text: #000000 !important;
              --tw-color-brand-bg: #ffffff !important;
            }
            body, .printable-area { 
              background-color: #ffffff !important; 
              color: #000000 !important; 
            }
          `;
          clonedDoc.head.appendChild(safetyStyle);

          // 3. Remove all LINK tags (external stylesheets) which might contain oklch/oklab
          Array.from(clonedDoc.getElementsByTagName('link')).forEach(link => {
            if (link.rel === 'stylesheet') {
              link.remove();
            }
          });

          // 4. Regex replacement in ALL internal style tags
          // We use a broader regex to catch oklch/oklab even with complex parameters
          Array.from(clonedDoc.getElementsByTagName('style')).forEach(tag => {
            try {
              let cssText = tag.innerHTML;
              // Very aggressive replacement: find anything starting with oklch( or oklab( and matching until the closing paren
              // We handle potential nesting with a slightly smarter (though not perfect) negative lookahead if needed
              // or just match everything inside parens.
              cssText = cssText.replace(/oklch\s*\([^)]+\)/gi, '#121212');
              cssText = cssText.replace(/oklab\s*\([^)]+\)/gi, '#121212');
              // Also catch the Tailwind 4 / opacity patterns: oklch(...) / 0.5
              cssText = cssText.replace(/(oklch|oklab)\s*\([^)]+\)\s*\/\s*[0-9.]+/gi, '#121212');
              tag.innerHTML = cssText;
            } catch (e) {
              console.warn("Style sanitization failed for a tag", e);
            }
          });

          // 5. Force standard colors on the element and its children
          const el = clonedDoc.getElementById(elementId);
          if (el) {
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('color', '#000000', 'important');
            
            el.querySelectorAll('*').forEach((child: any) => {
              if (child.style) {
                child.style.setProperty('transition', 'none', 'important');
                child.style.setProperty('animation', 'none', 'important');
                
                // Check all style properties
                for (let i = 0; i < child.style.length; i++) {
                  const prop = child.style[i];
                  const val = child.style.getPropertyValue(prop);
                  if (val && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
                    // Try to map to something reasonable or just force black
                    let fallback = '#333333';
                    if (prop.includes('background')) fallback = '#ffffff';
                    child.style.setProperty(prop, fallback, 'important');
                  }
                }
              }
              // Direct Tag overrides for typical text containers
              if (['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'TD', 'TH', 'B', 'STRONG'].includes(child.tagName)) {
                child.style.setProperty('color', '#000000', 'important');
              }
            });
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${filename}.pdf`);

      // Restaurar estado
      element.classList.remove('pdf-capture-active');
      buttons.forEach((btn: any) => btn.style.display = '');
      
      toast.dismiss(loadingToast);
      toast.success("PDF generado correctamente");
    } catch (err) {
      console.error("Error al generar PDF:", err);
      toast.dismiss(loadingToast);
      
      // Fallback: If html2canvas fails, try to use just the window.print() but styled for PDF
      toast.error("Error al generar el PDF. Intentando método alternativo...");
      const element = document.getElementById(elementId);
      if (element) {
        element.classList.remove('pdf-capture-active');
        const buttons = element.querySelectorAll('.no-print');
        buttons.forEach((btn: any) => btn.style.display = '');
      }
      
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  const closeAllModals = (e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setShowPaymentModal(false); 
    setShowReceiptModal(false); 
    setShowNewLoanModal(false); 
    setShowCashModal(false); 
    setShowRenewModal(false); 
    setShowScheduleModal(false); 
    setShowEditModal(false); 
    setShowContractModal(false); 
    setShowMigrationModal(false);
    setShowEditTransactionModal(false);
    setShowGrowthModal(false);
    
    // Retrasar un poco la limpieza de datos para permitir que las animaciones terminen
    setTimeout(() => {
      setCurrentLoan(null); 
      setSystemMessage(null);
      setFormError(null);
      setPaymentAmount('');
      setMigrationText('');
      setEditTransactionForm({ amount: '', concept: '', date: '' });
    }, 300);
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
                 `flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${
                   activeTab === 'activos' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'
                 }`
               }>Activos</button>
               <button onClick={() => setActiveTab('historial')} className={
                 `flex-1 lg:px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${
                   activeTab === 'historial' ? 'bg-brand-primary text-white shadow-md' : 'text-brand-text/40 hover:text-brand-text/60'
                 }`
               }>Historial</button>
            </div>

            {activeTab === 'historial' && pastLoans.length > 0 && (
              <button 
                onClick={handleClearPastLoans}
                className="bg-brand-red/10 text-brand-red px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:bg-brand-red hover:text-white transition-all flex items-center gap-1 border border-brand-red/20"
              >
                <Trash className="w-3 h-3" /> BORRAR CERRADOS
              </button>
            )}

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
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={() => {
                        setEditForm({
                          client: l.client,
                          phone: l.phone,
                          idNumber: l.idNumber || "",
                          address: l.address || "",
                          workplace: l.workplace || "",
                          remaining: l.remaining.toString(),
                          fixedQuota: l.fixedQuota ? l.fixedQuota.toString() : "",
                          status: l.status
                        });
                        setCurrentLoan(l);
                        setShowEditModal(true);
                      }}
                      className="p-2 bg-brand-bg text-brand-text/30 hover:text-brand-primary rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${l.status === 'ACTIVO' ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' : 'bg-brand-red/10 text-brand-red border border-brand-red/20'}`}>
                      {l.status}
                    </div>
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
                        <p className="text-sm font-black text-brand-primary">{formatMoney(l.fixedQuota || (l.debt / l.installments))}</p>
                      </div>
                   </div>

                   <div className="relative h-2 bg-brand-bg rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${l.progress}%` }}
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
                  <button 
                    onClick={() => { setCurrentLoan(l); setShowContractModal(true); } }
                    className="bg-brand-primary text-white py-3 rounded-xl font-black text-[9px] border border-brand-primary uppercase hover:brightness-110 transition-all font-mono shadow-lg shadow-brand-primary/20"
                   >IMPRIMIR CONTRATO</button>
                   <button 
                    onClick={() => { setShowCashModal(true); setSearchTerm(l.client); } }
                    className="col-span-2 bg-brand-bg text-brand-text/30 py-3 rounded-xl font-black text-[9px] border border-brand-border border-dashed uppercase hover:text-brand-primary hover:border-brand-primary transition-all mt-2"
                   >VER HISTORIAL DE PAGOS</button>
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

      <AnimatePresence>
        {/* Modal Recaudar */}
        {showPaymentModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md printable-area">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-brand-surface w-full h-full md:h-auto md:max-w-md md:rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-brand-border"
            >
              <div className="p-6 md:p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg">
                <div>
                   <h2 className="text-xl font-black text-brand-text uppercase tracking-tight">REGISTRAR RECAUDO</h2>
                   <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest">{currentLoan.client}</p>
                </div>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text p-2"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto">
                <div className="bg-brand-bg/50 p-6 rounded-2xl border border-brand-border text-center shadow-inner">
                  <p className="text-[10px] font-black text-brand-text/30 uppercase mb-2 tracking-widest">Saldo Pendiente Actual</p>
                  <h3 className="text-4xl font-black text-brand-text font-mono tracking-tighter">{formatMoney(currentLoan.remaining)}</h3>
                </div>

                <form onSubmit={handleProcessPayment} className="space-y-4 px-1">
                  <div>
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Monto a Recaudar ($)</label>
                    <input 
                      type="number"
                      autoFocus
                      step="any"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border p-5 rounded-2xl font-black text-2xl text-brand-text focus:border-brand-primary outline-none transition-all shadow-inner font-mono"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     {[500, 1000, 2000, 5000].map(amt => (
                       <button 
                        key={amt}
                        type="button"
                        onClick={() => setPaymentAmount(amt.toString())}
                        className="py-3 bg-brand-bg border border-brand-border rounded-xl text-[10px] font-black text-brand-text/40 hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all uppercase"
                       >+{amt}</button>
                     ))}
                  </div>

                  {currentLoan.remaining > 0 && (
                     <button 
                      type="button"
                      onClick={() => setPaymentAmount(currentLoan.remaining.toString())}
                      className="w-full py-3 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-xl text-[10px] font-black uppercase hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                     >SALDAR TOTAL: {formatMoney(currentLoan.remaining)}</button>
                  )}

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isSubmitting || !paymentAmount}
                      className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-2xl shadow-brand-primary/30 hover:bg-brand-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'PROCESANDO...' : 'CONFIRMAR PAGO'}
                    </button>
                    {formError && <p className="mt-3 text-brand-red text-[9px] font-black uppercase text-center">{formError}</p>}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Recibo Digital */}
        {showReceiptModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/98 z-[60] flex items-center justify-center p-0 md:p-4 backdrop-blur-xl printable-area">
            <motion.div 
              id="receipt-pdf-content"
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              className="bg-white text-slate-900 w-full h-full md:h-auto md:max-w-sm md:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative print:shadow-none print:border-none"
            >
              <button onClick={(e) => closeAllModals(e)} className="absolute top-8 right-8 text-slate-300 hover:text-brand-primary transition-all p-2 z-10 no-print"><X className="w-8 h-8" /></button>
              
              <div className="p-8 pb-4 text-center">
                 <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-brand-primary" />
                 </div>
                 <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">PAGO EXITOSO</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Transacción procesada correctamente</p>
              </div>

              <div className="p-10 space-y-6 flex-1 overflow-y-auto">
                 <div className="border-y-2 border-slate-100 py-8 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       <span>CLIENTE</span>
                       <span className="text-slate-900 font-bold">{currentLoan.client}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       <span>FORMA DE PAGO</span>
                       <span className="text-slate-900 font-bold">EFECTIVO / CAJA</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       <span>FECHA</span>
                       <span className="text-slate-900 font-bold">{receiptDate}</span>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-8 rounded-3xl text-center space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MONTO PAGADO</p>
                    <h3 className="text-5xl font-black text-brand-primary tracking-tighter">{formatMoney(lastPaidAmount)}</h3>
                 </div>

                 <div className="text-center bg-brand-primary/5 p-6 rounded-2xl border border-brand-primary/10">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">SALDO RESTANTE</p>
                    <p className="text-xl font-black text-brand-primary">{formatMoney(currentLoan.remaining)}</p>
                 </div>
              </div>

              <div className="p-10 flex flex-col gap-3 no-print">
                 <button onClick={() => handleDownloadPDF('receipt-pdf-content', `Recibo_${currentLoan.client.replace(/\s+/g, '_')}_${new Date().getTime()}`)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <Download className="w-4 h-4" /> DESCARGAR COMPROBANTE PDF
                 </button>
                 <button onClick={(e) => closeAllModals(e)} className="w-full bg-slate-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 hover:text-slate-600 transition-all">
                    CERRAR VENTANA
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Plan de Pagos */}
        {showScheduleModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md printable-area">
            <motion.div 
              id="schedule-pdf-content"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              className="bg-brand-surface w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[100vh] md:max-h-[85vh] border border-brand-border"
            >
              <div className="p-6 md:p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg sticky top-0 z-20">
                <div className="flex items-center gap-4">
                  <div className="bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/20">
                    <ListChecks className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-brand-text uppercase tracking-tight">Plan de Pagos</h2>
                    <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest">{currentLoan.client}</p>
                  </div>
                </div>
                <div className="flex gap-2 no-print">
                   <button onClick={() => handleDownloadPDF('schedule-pdf-content', `Plan_Pagos_${currentLoan.client.replace(/\s+/g, '_')}`)} className="px-6 py-3 bg-brand-primary text-white rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-brand-primary/20 hover:brightness-110 transition-all">
                     <Download className="w-4 h-4" /> DESCARGAR PLAN PDF
                   </button>
                   <button onClick={(e) => closeAllModals(e)} className="p-3 text-brand-text/20 hover:text-brand-text transition-transform hover:scale-110"><X className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 md:p-8 space-y-6 bg-brand-bg/30">
                {/* Visualización para impresión */}
                <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                  <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Plan de Pagos</h1>
                  <div className="flex justify-between mt-4 text-[10px] font-bold uppercase text-slate-500">
                    <div>
                      <p>CLIENTE: <span className="text-slate-900">{currentLoan.client}</span></p>
                      <p>TELÉFONO: <span className="text-slate-900">{currentLoan.phone}</span></p>
                    </div>
                    <div className="text-right">
                      <p>FECHA: <span className="text-slate-900">{new Date().toLocaleDateString()}</span></p>
                      <p>ESTADO: <span className="text-slate-900">{currentLoan.status}</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-x-auto shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-brand-bg/50 border-b border-brand-border">
                        <th className="px-6 py-4 text-[9px] font-black text-brand-text/30 uppercase tracking-widest">Cuota</th>
                        <th className="px-6 py-4 text-[9px] font-black text-brand-text/30 uppercase tracking-widest">Vence</th>
                        <th className="px-6 py-4 text-[9px] font-black text-brand-text/30 uppercase tracking-widest text-right">Monto</th>
                        <th className="px-6 py-4 text-[9px] font-black text-brand-text/30 uppercase tracking-widest text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/50">
                      {calculateSchedule(currentLoan).map((s) => (
                        <tr key={s.num} className="hover:bg-brand-bg/30 transition-colors group">
                          <td className="px-6 py-4 font-black text-xs text-brand-text/40">#{s.num}</td>
                          <td className="px-6 py-4 font-bold text-xs text-brand-text/60">{s.date}</td>
                  <td className="px-6 py-4 font-black text-sm font-mono text-right text-brand-text/80">
                    <div className="flex flex-col items-end">
                      <span>{formatMoney(s.amountDue > 0 && s.amountDue < s.amount ? s.amountDue : s.amount)}</span>
                      {s.amountDue > 0 && s.amountDue < s.amount && <span className="text-[10px] text-brand-primary">PENDIENTE</span>}
                      {s.mora > 0 && <span className="text-[8px] text-brand-red">+{formatMoney(s.mora)} MORA</span>}
                    </div>
                  </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center items-center gap-2">
                               {s.status === 'PAGADO' ? (
                                 <div className="bg-brand-green/10 text-brand-green px-3 py-1 rounded-full text-[8px] font-black uppercase border border-brand-green/20 flex items-center gap-1">
                                   <Check className="w-3 h-3" /> PAGADO
                                 </div>
                               ) : s.status === 'MORA' ? (
                                 <div className="bg-brand-red/10 text-brand-red px-3 py-1 rounded-full text-[8px] font-black uppercase border border-brand-red/20 flex items-center gap-1">
                                   <AlertCircle className="w-3 h-3" /> {formatMoney(s.mora)} MORA
                                 </div>
                               ) : (
                                 <div className="bg-brand-text/5 text-brand-text/30 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-brand-border flex items-center gap-1">
                                   <History className="w-3 h-3" /> PENDIENTE
                                 </div>
                               )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Nuevo Préstamo */}
        {showNewLoanModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              className="bg-brand-surface w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-brand-border"
            >
              <div className="p-6 md:p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg">
                <div className="flex items-center gap-4">
                  <div className="bg-brand-primary/10 p-3 rounded-2xl border border-brand-primary/20">
                    <TrendingUp className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-brand-text uppercase tracking-tight">NUEVA INVERSIÓN</h2>
                    <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest">Apertura de Préstamo Personal</p>
                  </div>
                </div>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text p-2"><X className="w-6 h-6" /></button>
              </div>

              <form onSubmit={handleSaveNewLoan} className="p-6 md:p-10 space-y-8 flex-1 overflow-y-auto bg-brand-bg/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Cliente Completo</label>
                    <input 
                      required 
                      value={newLoanForm.client}
                      onChange={(e) => setNewLoanForm({...newLoanForm, client: e.target.value})}
                      className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-bold text-brand-text focus:border-brand-primary outline-none shadow-sm transition-all"
                      placeholder="Juan Pérez..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Teléfono</label>
                    <input 
                      required 
                      value={newLoanForm.phone}
                      onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})}
                      className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-bold text-brand-text focus:border-brand-primary outline-none shadow-sm transition-all"
                      placeholder="809-000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Fecha de Inicio</label>
                    <input 
                      type="date"
                      required 
                      value={newLoanForm.startDate}
                      onChange={(e) => setNewLoanForm({...newLoanForm, startDate: e.target.value})}
                      className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-black text-xs text-brand-text/60 focus:border-brand-primary outline-none shadow-sm"
                    />
                  </div>
                  
                  <div className="md:col-span-2 border-t border-brand-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Método de Cálculo</label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setNewLoanForm({...newLoanForm, calcMethod: 'interes'})}
                          className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${newLoanForm.calcMethod === 'interes' ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20' : 'bg-brand-surface text-brand-text/40 border-brand-border'}`}
                        >Por Interés (%)</button>
                        <button 
                          type="button"
                          onClick={() => setNewLoanForm({...newLoanForm, calcMethod: 'fija'})}
                          className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase border transition-all ${newLoanForm.calcMethod === 'fija' ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20' : 'bg-brand-surface text-brand-text/40 border-brand-border'}`}
                        >Cuota Fija ($)</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-brand-primary uppercase tracking-widest mb-2 px-1">Capital a Invertir ($)</label>
                      <input 
                        type="number"
                        required 
                        value={newLoanForm.capital}
                        onChange={(e) => setNewLoanForm({...newLoanForm, capital: e.target.value})}
                        className="w-full bg-brand-surface border-2 border-brand-primary/20 p-4 rounded-xl font-black text-lg text-brand-text focus:border-brand-primary outline-none shadow-xl shadow-brand-primary/5 font-mono"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {newLoanForm.calcMethod === 'interes' ? (
                      <div>
                        <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Tasa Interés (%)</label>
                        <input 
                          type="number"
                          required 
                          value={newLoanForm.interestRate}
                          onChange={(e) => setNewLoanForm({...newLoanForm, interestRate: e.target.value})}
                          className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-black text-lg text-brand-text focus:border-brand-primary outline-none font-mono"
                          placeholder="20"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Monto Cuota ($)</label>
                        <input 
                          type="number"
                          required 
                          value={newLoanForm.fixedQuota}
                          onChange={(e) => setNewLoanForm({...newLoanForm, fixedQuota: e.target.value})}
                          className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-black text-lg text-brand-text focus:border-brand-primary outline-none font-mono"
                          placeholder="2700"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Núm. Cuotas</label>
                      <input 
                        type="number"
                        required 
                        value={newLoanForm.installments}
                        onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})}
                        className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-black text-lg text-brand-text focus:border-brand-primary outline-none font-mono"
                        placeholder="8"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 px-1">Frecuencia</label>
                      <select 
                        value={newLoanForm.freqDays}
                        onChange={(e) => setNewLoanForm({...newLoanForm, freqDays: e.target.value})}
                        className="w-full bg-brand-surface border border-brand-border p-4 rounded-xl font-black text-xs uppercase text-brand-text focus:border-brand-primary outline-none cursor-pointer"
                      >
                        <option value="1">Diario</option>
                        <option value="7">Semanal</option>
                        <option value="15">Quincenal</option>
                        <option value="30">Mensual</option>
                      </select>
                    </div>
                  </div>
                </div>

                {formError && <p className="text-brand-red text-[10px] font-black uppercase text-center bg-brand-red/5 py-4 rounded-xl border border-brand-red/10">{formError}</p>}

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={(e) => closeAllModals(e)}
                    className="flex-1 bg-brand-bg text-brand-text/30 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-brand-border hover:bg-brand-secondary transition-all"
                  >CANCELAR</button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-brand-primary text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-brand-primary/30 hover:bg-brand-primary/90 active:scale-[0.98] transition-all"
                  >
                    {isSubmitting ? 'GENERANDO...' : 'REGISTRAR PRÉSTAMO'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Editar */}
        {showEditModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              className="bg-brand-surface w-full min-h-screen md:min-h-0 md:max-w-xl md:rounded-2xl shadow-2xl p-6 md:p-10 relative border border-brand-border"
            >
              <button onClick={(e) => closeAllModals(e)} className="absolute top-6 right-6 text-brand-text/20 hover:text-brand-text z-10 p-2">
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-xl md:text-2xl font-black text-brand-text mb-8 tracking-tight uppercase">Editar Información</h2>
              
              <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-10 md:pb-0">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Nombre del Cliente</label>
                  <input 
                    required 
                    value={editForm.client}
                    onChange={(e) => setEditForm({...editForm, client: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Teléfono</label>
                  <input 
                    required 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Cédula</label>
                  <input 
                    value={editForm.idNumber}
                    onChange={(e) => setEditForm({...editForm, idNumber: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Dirección Residencial</label>
                  <input 
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Lugar de Trabajo</label>
                  <input 
                    value={editForm.workplace}
                    onChange={(e) => setEditForm({...editForm, workplace: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Saldo Actual</label>
                  <input 
                    type="number"
                    step="any"
                    value={editForm.remaining}
                    onChange={(e) => setEditForm({...editForm, remaining: e.target.value})}
                    className="w-full border border-brand-border p-4 rounded-xl font-bold bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2 text-brand-primary">Cuota Fija (Manual)</label>
                  <input 
                    type="number"
                    step="any"
                    placeholder="Ej: 2700"
                    value={editForm.fixedQuota}
                    onChange={(e) => setEditForm({...editForm, fixedQuota: e.target.value})}
                    className="w-full border-2 border-brand-primary/20 p-4 rounded-xl font-bold bg-brand-primary/5 text-brand-primary focus:border-brand-primary transition-all outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Estado</label>
                  <select 
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value as any})}
                    className="w-full border border-brand-border p-4 rounded-xl font-black text-[10px] uppercase bg-brand-bg text-brand-text focus:border-brand-primary/50 transition-all outline-none"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="PAGADO">PAGADO</option>
                    <option value="RENOVADO">RENOVADO</option>
                  </select>
                </div>

                <div className="md:col-span-2 pt-4 flex flex-col gap-3">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full bg-brand-primary text-white py-5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-brand-primary/20 transition-all ${isSubmitting ? 'opacity-50' : 'hover:bg-brand-primary/80 active:scale-[0.98]'}`}
                  >
                    {isSubmitting ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                  </button>

                  <button 
                    type="button"
                    onClick={handleDeleteLoan}
                    disabled={isSubmitting}
                    className="w-full bg-brand-red/10 text-brand-red py-4 rounded-xl font-black uppercase text-[9px] tracking-widest border border-brand-red/20 hover:bg-brand-red hover:text-white transition-all shadow-sm"
                  >
                    ELIMINAR PRÉSTAMO POR COMPLETO
                  </button>
                  
                  {formError && <p className="mt-4 text-brand-red text-[10px] font-black uppercase text-center">{formError}</p>}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Contrato */}
        {showContractModal && currentLoan && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto printable-area">
            <motion.div 
              id="contract-pdf-content"
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
                <button onClick={(e) => closeAllModals(e)} className="text-slate-400 hover:text-slate-900 transition-colors"><X /></button>
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
                      Me comprometo a pagar la suma total adeudada de <span className="font-black">
                        {formatMoney((currentLoan.fixedQuota && currentLoan.fixedQuota > 0) ? (currentLoan.fixedQuota * currentLoan.installments) : currentLoan.debt)}
                      </span>, 
                      incluyendo los intereses generados, mediante un plan de 
                      <span className="font-bold"> {currentLoan.installments} cuotas</span> de 
                      <span className="font-bold"> {formatMoney(currentLoan.fixedQuota || (currentLoan.debt / currentLoan.installments))}</span>, 
                      con una frecuencia de pago cada <span className="font-bold">{currentLoan.freqDays} días</span>.
                    </p>

                    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden print:border-slate-400">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2 font-black uppercase">Cuota</th>
                            <th className="px-4 py-2 font-black uppercase">Vencimiento</th>
                            <th className="px-4 py-2 font-black uppercase text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {calculateSchedule(currentLoan).slice(0, 8).map(s => (
                            <tr key={s.num}>
                              <td className="px-4 py-2">#{s.num}</td>
                              <td className="px-4 py-2 font-mono uppercase">{s.date}</td>
                              <td className="px-4 py-2 text-right font-black">{formatMoney(s.amount)}</td>
                            </tr>
                          ))}
                          {currentLoan.installments > 8 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-1 text-center text-[8px] bg-slate-50 text-slate-400 font-bold uppercase italic">
                                ... se omiten {currentLoan.installments - 8} cuotas intermedias ...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    <p className="mt-6">
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

              <div className="p-8 border-t border-brand-border bg-brand-surface flex gap-4 no-print sticky bottom-0">
                <button 
                  onClick={() => handleDownloadPDF('contract-pdf-content', `Contrato_${currentLoan.client.replace(/\s+/g, '_')}`)}
                  className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" /> DESCARGAR CONTRATO PDF
                </button>
                <button 
                  onClick={(e) => closeAllModals(e)}
                  className="px-10 bg-slate-100 text-slate-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                >
                  CERRAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Gestión de Caja */}
        {showCashModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-50 flex items-center justify-center p-0 md:p-4 backdrop-blur-md printable-area">
            <motion.div 
              id="cash-history-pdf-content"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-brand-surface w-full h-full md:h-auto md:max-w-xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[100vh] md:max-h-[85vh] border border-brand-border"
            >
              <div className="bg-brand-surface p-6 md:p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg sticky top-0 z-10">
                <h3 className="font-black text-sm md:text-lg uppercase tracking-tight text-brand-text">CONTROL DE CAJA</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadPDF('cash-history-pdf-content', `Reporte_Caja_${new Date().toLocaleDateString('es-DO').replace(/\//g, '-')}`)} 
                    className="p-2 bg-brand-secondary text-brand-text/50 rounded-lg border border-brand-border hover:text-brand-primary no-print"
                    title="Descargar Historial PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text p-2 no-print"><X /></button>
                </div>
              </div>
              
              <div className="p-4 md:p-8 overflow-y-auto flex-1 space-y-6 md:space-y-8 bg-brand-bg/50">
                {/* Formulario rápido */}
                <div className="bg-brand-surface p-4 md:p-6 rounded-2xl border border-brand-border shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
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
                      className="md:col-span-2 bg-brand-bg border border-brand-border rounded-xl p-4 font-bold text-xs text-brand-text outline-none focus:border-brand-primary/50"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (!user || !cashForm.amount || !cashForm.concept) return;
                      const am = parseFloat(cashForm.amount);
                      if (cashForm.type === 'RETIRO' && am > totals.caja) return toast.error("Fondos insuficientes.");
                      setIsSubmitting(true);
                      try {
                        await addDoc(collection(db, 'artifacts', APP_DATA_PREFIX, 'users', user.uid, 'transactions'), {
                          ...cashForm, amount: am, date: new Date().toISOString()
                        });
                        setCashForm({ type: 'INYECCION', amount: '', concept: '' });
                        toast.success("Movimiento registrado");
                      } catch (e: any) { 
                        toast.error("Error al registrar movimiento"); 
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition-all active:scale-95"
                  >
                    {isSubmitting ? 'REGISTRANDO...' : 'REGISTRAR MOVIMIENTO'}
                  </button>
                </div>

                {/* Lista */}
                <div className="space-y-4">
                  <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest px-2">Historial Reciente</p>
                  <div className="divide-y divide-brand-border/50">
                    {transactions.slice(0, 50).map(t => (
                      <div key={t.id} className="py-4 md:py-5 flex justify-between items-center group">
                        <div className="flex gap-3 md:gap-4 items-center overflow-hidden">
                          <div className={`p-2 md:p-3 rounded-lg md:rounded-xl border shrink-0 ${t.type === 'RETIRO' ? 'bg-brand-red/10 text-brand-red border-brand-red/20' : 'bg-brand-green/10 text-brand-green border-brand-green/20'}`}>
                            {t.type === 'RETIRO' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div className="truncate">
                            <p className="text-[10px] md:text-xs font-black uppercase text-brand-text mb-1 tracking-tight truncate">{t.concept}</p>
                            <p className="text-[8px] md:text-[9px] font-bold text-brand-text/30 uppercase">{new Date(t.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={`font-black text-sm md:text-lg font-mono tracking-tighter shrink-0 ml-4 ${t.type === 'RETIRO' ? 'text-brand-red' : 'text-brand-green'}`}>
                            {t.type === 'RETIRO' ? '-' : '+'}{formatMoney(t.amount)}
                          </p>
                          <div className="flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                            {t.type === 'INYECCION' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintOldReceipt(t);
                                }}
                                className="p-2 md:p-3 bg-brand-primary/10 text-brand-primary rounded-lg border border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                                title="Descargar Comprobante PDF"
                              >
                                <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTransaction(t);
                                setEditTransactionForm({ amount: t.amount.toString(), concept: t.concept, date: t.date.split('T')[0] });
                                setShowEditTransactionModal(true);
                              }}
                              className="p-2 md:p-3 bg-brand-primary/10 text-brand-primary rounded-lg border border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                              title="Modificar"
                            >
                              <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (t.loanId || t.concept.includes("Abono") || t.concept.includes("Pago")) {
                                  handleReversePayment(t);
                                } else {
                                  if (window.confirm("¿Eliminar este movimiento de caja?")) {
                                    try {
                                      await deleteDoc(doc(db, 'artifacts', APP_DATA_PREFIX, 'users', user!.uid, 'transactions', t.id));
                                      toast.success("Movimiento eliminado");
                                    } catch (err: any) {
                                      toast.error("Error al eliminar: " + err.message);
                                    }
                                  }
                                }
                              }}
                              className="p-2 md:p-3 bg-brand-red/10 text-brand-red rounded-lg border border-brand-red/20 hover:bg-brand-red hover:text-white transition-all shadow-sm"
                              title="Reversar / Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Estadísticas de Crecimiento */}
        {showGrowthModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-brand-surface w-full h-full md:h-auto md:max-w-3xl md:rounded-2xl shadow-2xl border border-brand-border flex flex-col max-h-[100vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg sticky top-0 z-10">
                <div>
                  <h2 className="text-xl md:text-2xl font-black mb-1 uppercase tracking-tight text-brand-text">Crecimiento del Negocio</h2>
                  <p className="text-brand-text/30 font-bold text-[10px] uppercase tracking-widest">Resumen de Recaudos Mensuales y Anuales</p>
                </div>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text"><X /></button>
              </div>

              <div className="p-4 md:p-8 overflow-y-auto flex-1 space-y-8 bg-brand-bg/50">
                {/* Cuadros de Resumen Anual */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {growthStats.annual.map(([year, data]) => (
                    <div key={year} className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-sm flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Utilidad Real Anual {year}</p>
                        <h4 className="text-3xl font-black text-brand-green font-mono">{formatMoney(data.interest)}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-brand-text/30 uppercase tracking-widest mb-2">Recaudo Total</p>
                        <h4 className="text-xl font-black text-brand-text/50 font-mono">{formatMoney(data.total)}</h4>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detalle Mensual */}
                <div>
                  <h3 className="text-xs font-black text-brand-text/50 uppercase tracking-widest mb-4 px-2">Historial Mensual</h3>
                  <div className="space-y-3">
                    {growthStats.monthly.map(([month, data]) => {
                      const [y, m] = month.split('-');
                      const monthName = new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('es-DO', { month: 'long' });
                      return (
                        <div key={month} className="bg-brand-surface p-5 rounded-2xl border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="bg-brand-primary/10 w-12 h-12 rounded-xl flex items-center justify-center border border-brand-primary/20 text-brand-primary font-black uppercase text-xs">
                              {monthName.substring(0, 3)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-brand-text uppercase">{monthName} {y}</p>
                              <p className="text-[10px] font-bold text-brand-text/30 uppercase">{data.count} Cobros registrados</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-8 text-right">
                            <div>
                              <p className="text-[9px] font-black text-brand-text/30 uppercase tracking-widest mb-1">Recaudo Total</p>
                              <h4 className="text-lg font-black text-brand-text/60 font-mono tracking-tighter">{formatMoney(data.total)}</h4>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-brand-green/60 uppercase tracking-widest mb-1">Utilidad Real (Interés)</p>
                              <h4 className="text-xl font-black text-brand-green font-mono tracking-tighter">{formatMoney(data.interest)}</h4>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-brand-bg border-t border-brand-border">
                <button onClick={(e) => closeAllModals(e)} className="w-full bg-brand-secondary text-brand-text/50 py-4 rounded-xl font-black uppercase text-[10px] border border-brand-border transition-all active:scale-95">
                  CERRAR PANEL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal Respaldos / Migración */}
        {showMigrationModal && (
          <div className="fixed inset-0 bg-brand-bg/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.98 }}
               className="bg-brand-surface rounded-2xl w-full max-w-2xl p-10 shadow-2xl border border-brand-border"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black mb-1 uppercase tracking-tight text-brand-text">RESPALDO DE DATOS</h2>
                  <p className="text-brand-text/30 font-bold text-[10px] uppercase tracking-widest">Respaldo y Transferencia Manual</p>
                </div>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text"><X /></button>
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
                        closeAllModals();
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
                <button onClick={(e) => closeAllModals(e)} className="w-full bg-brand-secondary text-brand-text/40 py-5 rounded-xl font-black uppercase text-[10px] border border-brand-border transition-all">
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Modal Editar Movimiento */}
      <AnimatePresence>
        {showEditTransactionModal && selectedTransaction && (
          <div className="fixed inset-0 bg-brand-bg/95 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-brand-surface w-full max-w-md rounded-2xl shadow-2xl border border-brand-border overflow-hidden"
            >
              <div className="p-6 border-b border-brand-border flex justify-between items-center bg-gradient-to-r from-brand-surface to-brand-bg">
                <div>
                  <h2 className="text-xl font-black uppercase text-brand-text">Modificar Movimiento</h2>
                  <p className="text-brand-text/30 font-bold text-[10px] uppercase tracking-widest">Ajuste de registro contable</p>
                </div>
                <button onClick={(e) => closeAllModals(e)} className="text-brand-text/20 hover:text-brand-text"><X /></button>
              </div>

              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-brand-text/30 uppercase block mb-1">Monto ($)</label>
                    <input 
                      type="number"
                      value={editTransactionForm.amount}
                      onChange={(e) => setEditTransactionForm({...editTransactionForm, amount: e.target.value})}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 font-mono font-bold text-brand-text focus:border-brand-primary outline-none"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-brand-text/30 uppercase block mb-1">Concepto</label>
                    <input 
                      type="text"
                      value={editTransactionForm.concept}
                      onChange={(e) => setEditTransactionForm({...editTransactionForm, concept: e.target.value})}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 font-bold text-brand-text focus:border-brand-primary outline-none"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-brand-text/30 uppercase block mb-1">Fecha</label>
                    <input 
                      type="date"
                      value={editTransactionForm.date}
                      onChange={(e) => setEditTransactionForm({...editTransactionForm, date: e.target.value})}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 font-bold text-brand-text focus:border-brand-primary outline-none"
                    />
                 </div>

                 <div className="flex flex-col gap-3 pt-4">
                    <button 
                      onClick={async () => {
                        const amt = Number(editTransactionForm.amount);
                        if (isNaN(amt)) return toast.error("Monto inválido");
                        await handleUpdateTransaction(selectedTransaction, {
                          amount: amt,
                          concept: editTransactionForm.concept,
                          date: new Date(editTransactionForm.date).toISOString()
                        });
                        closeAllModals();
                      }}
                      disabled={isSubmitting}
                      className="w-full bg-brand-primary text-white py-4 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                    >
                      {isSubmitting ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        handleReversePayment(selectedTransaction);
                        closeAllModals();
                      }}
                      className="w-full bg-brand-red/10 text-brand-red py-4 rounded-xl font-black uppercase text-[10px] border border-brand-red/20 hover:bg-brand-red hover:text-white transition-all shadow-sm"
                    >
                      ELIMINAR MOVIMIENTO
                    </button>

                    <button 
                      onClick={(e) => closeAllModals(e)}
                      className="w-full bg-brand-bg text-brand-text/40 py-4 rounded-xl font-black uppercase text-[10px] border border-brand-border"
                    >
                      CANCELAR
                    </button>
                 </div>
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
