import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Frown } from 'lucide-react'
 
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
        <Frown className="h-24 w-24 text-muted-foreground" />
      <h1 className="font-headline text-5xl font-bold">404 - Not Found</h1>
      <p className="text-lg text-muted-foreground">Could not find the requested page.</p>
      <Button asChild>
        <Link href="/events">Return to Dashboard</Link>
      </Button>
    </div>
  )
}
