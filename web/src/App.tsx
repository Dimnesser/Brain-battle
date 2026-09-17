import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorScreen, SplashScreen } from './components/Screens';
import { AuthProvider, useAuth } from './store/auth';
import { ToastProvider } from './store/toast';
import { HomePage } from './pages/Home';
import { CasesPage } from './pages/Cases';
import { BonusesPage } from './pages/Bonuses';
import { LeaderboardPage } from './pages/Leaderboard';
import { ProfilePage } from './pages/Profile';
import { DepositPage } from './pages/Deposit';
import { WithdrawPage } from './pages/Withdraw';
import { PromoPage } from './pages/Promo';
import { ReferralsPage } from './pages/Referrals';
import { HistoryPage } from './pages/History';
import { NotificationsPage } from './pages/Notifications';
import { MockPaymentPage } from './pages/MockPayment';
import { Suspense, lazy } from 'react';

// Админку грузим отдельным чанком: она нужна единицам, а весит заметно
const AdminLayout = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminCases = lazy(() => import('./admin/AdminCases').then((m) => ({ default: m.AdminCases })));
const AdminPromos = lazy(() => import('./admin/AdminPromos').then((m) => ({ default: m.AdminPromos })));
const AdminFinance = lazy(() => import('./admin/AdminFinance').then((m) => ({ default: m.AdminFinance })));
import type { ReactElement } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function Gate(): ReactElement {
  const { user, loading, error, retry } = useAuth();

  if (loading) return <SplashScreen />;
  if (error || !user) return <ErrorScreen message={error ?? 'Профиль недоступен'} onRetry={retry} />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="bonuses" element={<BonusesPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="deposit" element={<DepositPage />} />
        <Route path="withdraw" element={<WithdrawPage />} />
        <Route path="promo" element={<PromoPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="payment/mock" element={<MockPaymentPage />} />
      </Route>

      {/* Админка живёт отдельным разделом со своей навигацией */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<SplashScreen />}>
            <AdminLayout />
          </Suspense>
        }
      >
        <Route index element={<Suspense fallback={<SplashScreen />}><AdminDashboard /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<SplashScreen />}><AdminUsers /></Suspense>} />
        <Route path="cases" element={<Suspense fallback={<SplashScreen />}><AdminCases /></Suspense>} />
        <Route path="promocodes" element={<Suspense fallback={<SplashScreen />}><AdminPromos /></Suspense>} />
        <Route path="finance" element={<Suspense fallback={<SplashScreen />}><AdminFinance /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App(): ReactElement {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <Gate />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
