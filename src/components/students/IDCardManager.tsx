
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Users, Settings, FileText, Image, Layout } from 'lucide-react';
import { IDCardPrinting } from './IDCardPrinting';

export const IDCardManager = () => {
  const [activeTab, setActiveTab] = useState('generate');

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <CreditCard className="mr-2 h-4 w-4" />
                Student ID Card System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                ID Card <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Professional student identification card generation with customizable templates and advanced printing options.
                Streamline your card production with premium tools.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                    <Layout className="h-5 w-5 text-indigo-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 bg-clip-text text-transparent">
                    ID Card Designer
                  </CardTitle>
                </div>
                <p className="text-slate-600 leading-relaxed">Create professional student ID cards with templates, photo management, and bulk printing capabilities</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl p-2 h-auto">
                    <TabsTrigger
                      value="generate"
                      className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-premium rounded-xl py-3 px-4 font-semibold transition-all duration-normal hover:bg-white/80"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Generate Cards
                    </TabsTrigger>
                    <div className="relative">
                      <div className="opacity-50 cursor-not-allowed bg-slate-100 rounded-xl py-3 px-4 font-semibold text-slate-400 flex items-center justify-center">
                        <Layout className="h-4 w-4 mr-2" />
                        Templates
                        <div className="absolute top-0 right-0 -mr-1 -mt-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs rounded-full font-medium animate-pulse shadow-glow-purple">
                          Soon
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="opacity-50 cursor-not-allowed bg-slate-100 rounded-xl py-3 px-4 font-semibold text-slate-400 flex items-center justify-center">
                        <Image className="h-4 w-4 mr-2" />
                        Photo Manager
                        <div className="absolute top-0 right-0 -mr-1 -mt-1 px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs rounded-full font-medium animate-pulse shadow-glow-green">
                          Soon
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="opacity-50 cursor-not-allowed bg-slate-100 rounded-xl py-3 px-4 font-semibold text-slate-400 flex items-center justify-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                        <div className="absolute top-0 right-0 -mr-1 -mt-1 px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full font-medium animate-pulse shadow-glow-orange">
                          Soon
                        </div>
                      </div>
                    </div>
                  </TabsList>

                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 p-8">
                    <TabsContent value="generate" className="mt-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 rounded-2xl"></div>
                        <div className="relative p-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                              <CreditCard className="h-5 w-5 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 bg-clip-text text-transparent">
                              Generate Student ID Cards
                            </h3>
                          </div>
                          <p className="text-slate-600 mb-6">
                            Generate and print ID cards for students with Spring of Knowledge Academy branding
                          </p>
                          <IDCardPrinting />
                        </div>
                      </div>
                    </TabsContent>

                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>
    </>
  );
};
