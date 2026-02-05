// AI-META-BEGIN
// AI-META: 404 error page - displayed for invalid routes
// OWNERSHIP: client/pages
// ENTRYPOINTS: Rendered by App.tsx catch-all route for unmatched paths
// DEPENDENCIES: @/components/ui/card, lucide-react (icons)
// DANGER: None - static error page
// CHANGE-SAFETY: Safe to modify error message and styling
// TESTS: Manual testing by navigating to invalid route
// AI-META-END

import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className='min-h-screen w-full flex items-center justify-center bg-gray-50'>
      <Card className='w-full max-w-md mx-4'>
        <CardContent className='pt-6'>
          <div className='flex mb-4 gap-2'>
            <AlertCircle className='h-8 w-8 text-red-500' />
            <h1 className='text-2xl font-bold text-gray-900'>404 Page Not Found</h1>
          </div>

          <p className='mt-4 text-sm text-gray-600'>
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
