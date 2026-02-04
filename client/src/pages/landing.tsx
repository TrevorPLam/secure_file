import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Cloud, Shield, Share2, FolderOpen, Lock, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Cloud className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">CloudVault</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
                Features
              </a>
              <a href="#security" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-security">
                Security
              </a>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a href="/api/login">
                <Button variant="ghost" data-testid="button-login">
                  Log in
                </Button>
              </a>
              <a href="/api/login">
                <Button data-testid="button-get-started">
                  Get Started
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Zap className="w-4 h-4" />
                  <span>Secure. Fast. Simple.</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                  Share files with
                  <span className="text-primary"> confidence</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  CloudVault makes file sharing effortless. Upload, organize, and share your files 
                  securely with password protection and expiring links.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <a href="/api/login">
                    <Button size="lg" className="gap-2" data-testid="button-start-free">
                      <Cloud className="w-5 h-5" />
                      Start Free
                    </Button>
                  </a>
                  <a href="#features">
                    <Button size="lg" variant="outline" data-testid="button-learn-more">
                      Learn More
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>256-bit encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>Password protection</span>
                  </div>
                </div>
              </div>
              <div className="relative lg:pl-8">
                <div className="relative bg-card rounded-lg border shadow-lg p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <span className="font-medium">My Files</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "Project Proposal.pdf", size: "2.4 MB", type: "pdf" },
                      { name: "Team Photos", size: "— ", type: "folder" },
                      { name: "Financial Report.xlsx", size: "1.2 MB", type: "excel" },
                      { name: "Presentation.pptx", size: "8.7 MB", type: "ppt" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover-elevate">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${
                          item.type === "folder" ? "bg-primary/10 text-primary" :
                          item.type === "pdf" ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
                          item.type === "excel" ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" :
                          "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                        }`}>
                          {item.type === "folder" ? <FolderOpen className="w-4 h-4" /> :
                           <span className="text-xs font-medium uppercase">{item.type === "pdf" ? "PDF" : item.type === "excel" ? "XLS" : "PPT"}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.size}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100">
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Everything you need for file sharing
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed to make file management and sharing a breeze.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Cloud,
                  title: "Cloud Storage",
                  description: "Store all your files securely in the cloud with unlimited organization options.",
                },
                {
                  icon: FolderOpen,
                  title: "Folder Organization",
                  description: "Create folders and subfolders to keep your files organized and easy to find.",
                },
                {
                  icon: Share2,
                  title: "Easy Sharing",
                  description: "Generate shareable links instantly. Share with anyone, anywhere.",
                },
                {
                  icon: Lock,
                  title: "Password Protection",
                  description: "Add passwords to your shared links for an extra layer of security.",
                },
                {
                  icon: Shield,
                  title: "Secure Encryption",
                  description: "All files are encrypted in transit and at rest using industry-standard encryption.",
                },
                {
                  icon: Zap,
                  title: "Fast Uploads",
                  description: "Lightning-fast upload speeds with support for large files up to 10GB.",
                },
              ].map((feature, i) => (
                <Card key={i} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  Enterprise-grade security
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Your data security is our top priority. We use the latest security measures 
                  to ensure your files are always protected.
                </p>
                <div className="space-y-4">
                  {[
                    "256-bit AES encryption for all files",
                    "Secure HTTPS connections",
                    "Optional password protection for shared links",
                    "Expiring links for time-sensitive sharing",
                    "Access tracking and download counts",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="bg-card rounded-lg border p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Protected by CloudVault</h3>
                      <p className="text-muted-foreground">Your files are safe with us</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">99.9%</p>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary">256-bit</p>
                      <p className="text-sm text-muted-foreground">Encryption</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-primary/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Ready to get started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of users who trust CloudVault for their file sharing needs.
            </p>
            <a href="/api/login">
              <Button size="lg" className="gap-2" data-testid="button-cta-get-started">
                <Cloud className="w-5 h-5" />
                Get Started for Free
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Cloud className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-medium">CloudVault</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CloudVault. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
