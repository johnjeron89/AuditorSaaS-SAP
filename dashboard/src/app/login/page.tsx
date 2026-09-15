'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, CheckCircle2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setEmailSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4">
        <div className="fixed inset-x-0 top-0 z-50 h-px bg-white/20" />
        <Card className="w-full max-w-md mx-4 sm:mx-auto border border-white/10 bg-white/[0.02] rounded-none animate-fade-in-up">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
                <Mail className="h-8 w-8 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Check your email</CardTitle>
            <CardDescription className="text-base text-white/50">
              We&apos;ve sent a confirmation link to
            </CardDescription>
            <p className="font-semibold text-white">{email}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border border-blue-400/20 bg-blue-400/5 rounded-lg p-4 text-sm text-blue-300">
              <div className="flex gap-2 items-start">
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-blue-400" />
                <div>
                  <p className="font-medium">Click the link in your email to verify your account.</p>
                  <p className="mt-1 text-blue-400/80">After confirming, you&apos;ll be redirected to the dashboard.</p>
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-white/40">
              <p>Didn&apos;t receive the email? Check your spam folder.</p>
            </div>
            <Button
              variant="outline"
              className="w-full border-white/25 bg-white/[0.05] text-white rounded-none hover:bg-white/[0.1] hover:text-white"
              onClick={() => { setEmailSent(false); setIsSignUp(false) }}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4">
      <div className="fixed inset-x-0 top-0 z-50 h-px bg-white/20" />
      <Card className="w-full max-w-md mx-4 sm:mx-auto border border-white/10 bg-white/[0.02] rounded-none animate-fade-in-up">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">SAPVYRA<span className="text-white/40">.</span> Auditer</CardTitle>
          <CardDescription className="text-white/50">
            {isSignUp ? 'Create a new account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="min-h-[48px] sm:min-h-[40px]"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="min-h-[48px] sm:min-h-[40px]"
              />
            </div>
            {error && <div className="text-sm text-red-400 p-2 bg-red-500/10 border border-red-500/20 rounded-none">{error}</div>}
            <Button type="submit" className="w-full min-h-[48px] sm:min-h-[40px] bg-white text-black hover:bg-white/90 rounded-none" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                isSignUp ? 'Sign Up' : 'Sign In'
              )}
            </Button>
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
                className="text-blue-400 hover:text-white transition-colors"
                disabled={loading}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
