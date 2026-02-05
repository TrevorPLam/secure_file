// AI-META-BEGIN
// AI-META: Root App component - router setup, auth gating, and global provider wrapping
// OWNERSHIP: client/root
// ENTRYPOINTS: Rendered by main.tsx as application root
// DEPENDENCIES: wouter (routing), @tanstack/react-query (QueryClientProvider), @/hooks/use-auth (auth state), @/components/* (providers, pages)
// DANGER: Auth gate redirects unauthenticated users to landing page; loading state shows spinner; route matching is order-dependent
// CHANGE-SAFETY: Safe to add new routes, unsafe to change auth gating logic or provider order without testing
// TESTS: Manual testing with authenticated/unauthenticated states, verify all routes
// AI-META-END

import { Switch, Route } from 'wouter'
import { queryClient } from './lib/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useAuth } from '@/hooks/use-auth'
import NotFound from '@/pages/not-found'
import LandingPage from '@/pages/landing'
import DashboardPage from '@/pages/dashboard'
import ShareDownloadPage from '@/pages/share-download'
import { Cloud } from 'lucide-react'

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='w-12 h-12 rounded-lg bg-primary flex items-center justify-center animate-pulse'>
            <Cloud className='w-7 h-7 text-primary-foreground' />
          </div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LandingPage />
  }

  return <DashboardPage />
}

function Router() {
  return (
    <Switch>
      <Route path='/' component={AuthenticatedApp} />
      <Route path='/share/:token' component={ShareDownloadPage} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
