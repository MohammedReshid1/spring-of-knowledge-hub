import React from 'react';
import { Loader2, Building, Globe, MapPin } from 'lucide-react';

interface FullScreenLoadingProps {
  isOpen: boolean;
  message?: string;
  branchName?: string;
}

export const FullScreenLoading = ({ isOpen, message = "Please wait while we update your view...", branchName }: FullScreenLoadingProps) => {
  if (!isOpen) return null;

  const isAllBranches = branchName === 'All Branches';

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

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      <div className="fixed inset-0 z-[10000] bg-black/30 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 max-w-sm mx-4 animate-fadeInUp">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Building className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 animate-ping opacity-20"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800">Switching Branch</h3>
              <p className="text-sm text-slate-600">{message}</p>
              {branchName && (
                <div className="flex items-center justify-center space-x-2 p-2 bg-blue-50 rounded-lg">
                  {isAllBranches ? (
                    <Globe className="h-4 w-4 text-blue-600" />
                  ) : (
                    <MapPin className="h-4 w-4 text-purple-600" />
                  )}
                  <span className="text-sm font-medium text-slate-700">{branchName}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm text-slate-500 font-medium">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};