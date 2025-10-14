import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, Globe, MapPin } from 'lucide-react';

interface BranchSwitchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  branchName: string;
}

export const BranchSwitchDialog = ({ isOpen, onClose, onConfirm, branchName }: BranchSwitchDialogProps) => {
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

      <div className="fixed inset-0 z-[10000] bg-black/20 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md mx-4 animate-fadeInUp">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 animate-pulse opacity-20"></div>
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-slate-800">Switch Branch?</h3>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Are you sure you want to switch to
                </p>
                <div className="flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200/50">
                  {isAllBranches ? (
                    <Globe className="h-4 w-4 text-blue-600" />
                  ) : (
                    <MapPin className="h-4 w-4 text-purple-600" />
                  )}
                  <span className="font-semibold text-slate-800">{branchName}</span>
                </div>
                <p className="text-xs text-slate-500">
                  This will update your dashboard view and available data.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 w-full">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-200 hover:scale-[1.02]"
              >
                <div className="flex items-center space-x-2">
                  <span>Switch</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};